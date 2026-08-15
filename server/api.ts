import express, { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { randomUUID, randomBytes } from "crypto";
import { getSupabaseAdmin, SupabaseNotConfiguredError } from "./supabaseAdmin";
import { getStripe, getStripeWebhookSecrets, StripeNotConfiguredError } from "./stripe";
import { flowCopy, normalizeFlowLang, type FlowLang } from "./flowMessages";
import {
  renderEstimatePdf,
  renderInvoicePdf,
  renderPayrollPdf,
  documentNumber,
  normalizeDocLang,
  type BusinessIdentity,
  type DocLang,
  type DocLine,
  type TaxBreakdown,
} from "./documents";
import {
  markRequestPaidByInvoice,
  resolveAmount,
  sendPaymentRequest,
  sweepDueRequests,
} from "./paymentRequests";
import { closeEntryWithOvertime, workerPerformance } from "./workTime";
import { businessCoordinates } from "./geocode";
import { provisionWebhook, readStoredWebhookSecrets } from "./stripeWebhookSetup";
import { receivables } from "./receivables";
import { profitabilityByProject } from "./profitability";
import { exportAccounting, type ExportKind } from "./accountingExport";
import { stripeBalance } from "./stripeBalance";
import { sendRegistrationOTP, verifyRegistrationOTP } from "./resendOtp";
import {
  annualTotals,
  approvedHours,
  computePayroll,
  labourCostByProject,
  readDeductions,
  yearToDate,
} from "./payroll";
import {
  billMilestone,
  billMilestonesForTrigger,
  materializePlan,
  planTotalsCorrectly,
  readPlan,
  DEFAULT_PLAN,
  MILESTONE_TRIGGERS,
  TRIGGER_FOR_STATUS,
} from "./paymentPlans";
import {
  advanceProject,
  checkWorkOrdersComplete,
  lifecycleSnapshot,
  originFromClientSource,
  setProjectStatus,
  PROJECT_STATUSES,
} from "./lifecycle";
import {
  requireAuthenticatedUser,
  requireBusinessAuth,
  requireClientAuth,
  requireWorkerAuth,
  hashToken,
} from "./supabaseAuth";

export const apiRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const MAX_REFERENCE_DOCS_PER_CATEGORY = 5;

type Handler = (req: Request, res: Response) => Promise<void>;

// Base slug from a business name — ASCII, lowercase, dash-separated.
function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return base || "negocio";
}

// Appends -2, -3, ... on collision. Only ever called at business-creation
// time (one row), so the read-then-write race window is not worth locking.
async function generateUniqueSlug(admin: ReturnType<typeof getSupabaseAdmin>, name: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let suffix = 2;
  for (;;) {
    const { data } = await admin.from("businesses").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

// Fires the moment an estimate first reaches the client (status -> 'enviado'):
// provisions real portal access, since only now is there something real to
// show them (a 'pendiente_aprobacion' estimate can still change or be
// rejected). No-ops if the client already has an account. Reuses an
// existing auth account by email (e.g. a repeat client across businesses)
// instead of creating a duplicate.
async function ensureClientAccount(businessId: string, clientId: string) {
  const admin = getSupabaseAdmin();
  const { data: client, error: clientError } = await admin
    .from("clients")
    .select("id, email, auth_user_id")
    .eq("id", clientId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (clientError || !client || client.auth_user_id || !client.email) return;

  const { data: reusable } = await admin
    .from("clients")
    .select("auth_user_id")
    .eq("email", client.email)
    .not("auth_user_id", "is", null)
    .limit(1)
    .maybeSingle();

  let authUserId: string | null = reusable?.auth_user_id ?? null;

  if (!authUserId) {
    const randomPassword = randomBytes(24).toString("base64url");
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: client.email,
      password: randomPassword,
      email_confirm: true,
    });
    if (createError || !created.user) return;
    authUserId = created.user.id;
  }

  await admin.from("clients").update({ auth_user_id: authUserId }).eq("id", clientId);

  // The client's public chat_channel (created the moment they first messaged
  // via /c/[slug]) flips to 'interno' in place — same row, same history —
  // rather than a new channel being created. Only a manually-added client
  // with no prior public chat gets a fresh one here.
  const { data: existingChannel } = await admin
    .from("chat_channels")
    .select("id, flow_state")
    .eq("business_id", businessId)
    .eq("participant_type", "client")
    .eq("participant_id", clientId)
    .maybeSingle();

  // Keep speaking whatever language this client already chose in the public
  // chat, rather than resetting them to the default.
  const channelLang = normalizeFlowLang((existingChannel?.flow_state as any)?.lang);

  let channelId: string | undefined;
  if (existingChannel) {
    channelId = existingChannel.id;
    await admin.from("chat_channels").update({ system: "interno" }).eq("id", existingChannel.id);
  } else {
    const { data: created } = await admin
      .from("chat_channels")
      .insert({
        business_id: businessId,
        system: "interno",
        label: "cliente",
        participant_type: "client",
        participant_id: clientId,
        status: "activo",
      })
      .select("id")
      .single();
    channelId = created?.id;
  }

  if (channelId) {
    await admin.from("chat_messages").insert({
      channel_id: channelId,
      business_id: businessId,
      sender_type: "bot",
      content: flowCopy(channelLang).accountReady(client.email),
    });
  }
}

function computeExpiresAt(disappearingDuration: string): string | null {
  const ms = disappearingDuration === "24h" ? 24 * 3600000 : disappearingDuration === "72h" ? 72 * 3600000 : null;
  return ms ? new Date(Date.now() + ms).toISOString() : null;
}

// Lazily hard-deletes a channel's own expired messages the next time anyone
// reads it — no cron job needed, and a message is never shown to either
// side past its expiry regardless of when this runs.
async function purgeExpiredMessages(supabase: ReturnType<typeof getSupabaseAdmin>, channelId: string) {
  await supabase.from("chat_messages").delete().eq("channel_id", channelId).lt("expires_at", new Date().toISOString());
}

// ---------- Public chat: deterministic button-flow (no AI) ----------
// The public chat bubble has always just been a raw message store — there
// was never an LLM behind it. This gives it an actual brain: a fixed,
// business-agnostic question tree (buttons + short text inputs) that reads
// the business's own services (budget_categories) and, once complete, files
// a real bot-drafted estimate the admin finds waiting in Budgets & Estimates.
// State lives on chat_channels.flow_state so a page reload just resumes it.

type FlowStepId =
  | "welcome"
  | "select_service"
  | "describe_project"
  | "address"
  | "name"
  | "phone"
  | "email"
  | "summary"
  | "done";

const FLOW_FIELD: Partial<Record<FlowStepId, string>> = {
  select_service: "categoryId",
  describe_project: "description",
  address: "address",
  name: "name",
  phone: "phone",
  email: "email",
};

// "select_service" is skipped for businesses with no configured services —
// there's nothing to choose between, so it falls straight to the free-text
// description instead of showing an empty button list.
function flowOrder(hasCategories: boolean): FlowStepId[] {
  const base: FlowStepId[] = ["welcome", "select_service", "describe_project", "address", "name", "phone", "email", "summary", "done"];
  return hasCategories ? base : base.filter((s) => s !== "select_service");
}

function nextFlowStep(current: FlowStepId, hasCategories: boolean): FlowStepId {
  const order = flowOrder(hasCategories);
  const idx = order.indexOf(current);
  return order[Math.min(idx + 1, order.length - 1)];
}

interface FlowCategory {
  id: string;
  name: string;
}

// What the frontend renders for the CURRENT step — the corresponding bot
// message is a separate chat_messages row (posted once, when the step is
// entered), this only describes the input control to show underneath it.
function flowStepView(step: FlowStepId, categories: FlowCategory[], lang: FlowLang) {
  const copy = flowCopy(lang);
  switch (step) {
    case "welcome":
      return { step, kind: "button" as const, options: [{ value: "empezar", label: copy.startButton }] };
    case "select_service":
      return {
        step,
        kind: "buttons" as const,
        options: [...categories.map((c) => ({ value: c.id, label: c.name })), { value: "otro", label: copy.otherOption }],
      };
    case "describe_project":
      return { step, kind: "text" as const, placeholder: copy.describePlaceholder };
    case "address":
      return { step, kind: "text" as const, placeholder: copy.addressPlaceholder };
    case "name":
      return { step, kind: "text" as const, placeholder: copy.namePlaceholder };
    case "phone":
      return { step, kind: "text" as const, placeholder: copy.phonePlaceholder };
    case "email":
      return { step, kind: "text" as const, placeholder: copy.emailPlaceholder };
    case "summary":
      return { step, kind: "button" as const, options: [{ value: "enviar", label: copy.sendButton }] };
    case "done":
      return { step, kind: "terminal" as const, options: [] };
  }
}

function flowBotMessage(
  step: FlowStepId,
  businessName: string,
  categories: FlowCategory[],
  answers: Record<string, string>,
  lang: FlowLang
): string {
  const copy = flowCopy(lang);
  switch (step) {
    case "welcome":
      return copy.welcome(businessName);
    case "select_service":
      return copy.selectService;
    case "describe_project":
      return copy.describeProject;
    case "address":
      return copy.address;
    case "name":
      return copy.name;
    case "phone":
      return copy.phone;
    case "email":
      return copy.email;
    case "summary": {
      const categoryName = categories.find((c) => c.id === answers.categoryId)?.name ?? copy.otherService;
      return [
        copy.summaryHeader,
        `\u2022 ${copy.summaryService}: ${categoryName}`,
        `\u2022 ${copy.summaryProject}: ${answers.description ?? "-"}`,
        `\u2022 ${copy.summaryAddress}: ${answers.address ?? "-"}`,
        `\u2022 ${copy.summaryName}: ${answers.name ?? "-"}`,
        `\u2022 ${copy.summaryPhone}: ${answers.phone ?? "-"}`,
        `\u2022 ${copy.summaryEmail}: ${answers.email ?? "-"}`,
        copy.summaryConfirm,
      ].join("\n");
    }
    case "done":
      return copy.done(answers.name ?? "", businessName);
  }
}

// Files the bot-collected answers as a real draft the admin finds waiting
// in Budgets & Estimates — same 'pendiente_aprobacion' + created_by:'bot'
// state a human-drafted estimate reaches on its way to being sent.
async function createBotEstimate(
  admin: ReturnType<typeof getSupabaseAdmin>,
  businessId: string,
  clientId: string,
  answers: Record<string, string>
) {
  const { data: settings } = await admin
    .from("business_settings")
    .select("default_margin_type, default_waste_percent")
    .eq("business_id", businessId)
    .maybeSingle();

  await admin
    .from("estimates")
    .insert({
      business_id: businessId,
      client_id: clientId,
      category_id: answers.categoryId && answers.categoryId !== "otro" ? answers.categoryId : null,
      margin_type: settings?.default_margin_type ?? "global",
      waste_percent: settings?.default_waste_percent ?? 0,
      margin_percent: 0,
      status: "pendiente_aprobacion",
      created_by: "bot",
      description: answers.description ?? null,
    });
}

// ---------- Stripe Connect: payments, invoicing, Canadian sales tax ----------
// Each business connects its OWN Stripe Express account (below) — every
// charge is a "direct charge" made with the `stripeAccount` request option,
// so the money, Stripe fees, disputes and payouts all belong to that
// account, never to this platform's own Stripe balance.

// Stripe words the "your platform account is not a Connect platform" refusal
// several different ways depending on how far the platform account got, and
// all of them mean the same one-time signup that nobody can do from inside
// this app. Matching them together is what lets the UI show the actual
// instruction instead of Stripe's raw English sentence.
/**
 * The API version the Accounts v2 calls are pinned to.
 *
 * v2 refuses any request without an explicit version header, which is a good
 * thing: it means a change at Stripe cannot silently reshape what comes back.
 * Pinned rather than tracking latest, because the field that matters most here
 * — who collects the fees — must never move by surprise.
 */
const STRIPE_V2_VERSION = "2026-06-24.preview";

/**
 * Creates a connected account on which the CONTRACTOR pays Stripe's fees.
 *
 * This is not the default and the difference is money. Left to its defaults,
 * Stripe makes this platform liable for the processing fee on every charge
 * every contractor takes — recoverable only through an application fee, which
 * this product does not charge. It would quietly bill us for our customers'
 * revenue.
 *
 * So the three responsibilities are stated outright. `fees_collector: stripe`
 * is the one that matters: Stripe takes its cut from the connected account
 * directly and this platform never appears in that transaction.
 * `losses_collector` keeps disputes off us too, and `requirements_collector`
 * keeps us out of the contractor's identity paperwork.
 *
 * Accounts v1 is not an option any more. Asked to create an account the old
 * way, Stripe now answers "Stripe no longer recommends Accounts v1 for new
 * Connect integrations" and refuses, so this goes through v2 — where the same
 * arrangement is expressed as responsibilities rather than a controller.
 */
async function createConnectedAccount(
  stripe: ReturnType<typeof getStripe>,
  businessName: string | null | undefined,
  contactEmail?: string | null
): Promise<{ account: { id: string }; feesPayer: "account" }> {
  const account = await stripe.v2.core.accounts.create(
    {
      display_name: businessName ?? undefined,
      contact_email: contactEmail ?? undefined,
      // The contractor gets a real Stripe dashboard of their own. Express is
      // not available in this arrangement: Stripe only offers it to platforms
      // that collect the fees themselves, which is the thing being avoided.
      dashboard: "full",
      identity: { country: "ca", entity_type: "company" },
      configuration: {
        merchant: { capabilities: { card_payments: { requested: true } } },
      },
      defaults: {
        currency: "cad",
        responsibilities: {
          fees_collector: "stripe",
          losses_collector: "stripe",
        },
      },
      include: ["configuration.merchant", "identity", "requirements"],
    } as never,
    { apiVersion: STRIPE_V2_VERSION } as never
  );

  return { account, feesPayer: "account" };
}

/**
 * Whether an error means "this platform has not signed up for Connect".
 *
 * Deliberately narrow. It used to match any message containing a link to the
 * Connect docs, which caught the wrong thing the moment Stripe started
 * refusing Accounts v1: that refusal links to the v2 migration guide, so a
 * "your code is out of date" error was being shown to the business as "go and
 * sign up for Connect" — an instruction that would have sent them to a page
 * where everything already looked fine.
 */
function isConnectNotEnabled(message: string): boolean {
  return /signed up for Connect|Only Stripe Connect platforms|Connect.*(is )?not.*enabled|invalid.*client_id/i.test(
    message
  );
}

const INVOICE_TYPE_LABEL: Record<string, string> = { deposito: "Depósito", parcial: "Pago parcial", final: "Pago final" };

async function computeInvoiceTax(admin: ReturnType<typeof getSupabaseAdmin>, businessId: string, subtotal: number) {
  const { data: business, error: businessError } = await admin
    .from("businesses")
    .select("province")
    .eq("id", businessId)
    .single();
  if (businessError) throw businessError;

  const { data: rate, error: rateError } = await admin
    .from("canada_tax_rates")
    .select("province, label, is_hst, gst_rate, pst_rate, hst_rate")
    .eq("province", business.province)
    .single();
  if (rateError) throw rateError;

  if (rate.is_hst) {
    const hst = Math.round(subtotal * Number(rate.hst_rate) * 100) / 100;
    return { taxAmount: hst, breakdown: { province: rate.province, hst } };
  }
  const gst = Math.round(subtotal * Number(rate.gst_rate) * 100) / 100;
  const pst = Math.round(subtotal * Number(rate.pst_rate) * 100) / 100;
  return { taxAmount: gst + pst, breakdown: { province: rate.province, gst, pst } };
}

/**
 * The one place an invoice row is created.
 *
 * Tax and holdback are the two rules most easily got wrong, and they were
 * inline in a route until the payment plans needed to create invoices too —
 * two copies of this would have drifted, and the drift would be somebody's
 * tax return.
 */
async function createInvoiceRecord(
  admin: ReturnType<typeof getSupabaseAdmin>,
  input: {
    businessId: string;
    clientId: string;
    projectId: string | null;
    estimateId: string | null;
    type: "deposito" | "parcial" | "final";
    subtotal: number;
    description: string | null;
    dueDate?: string | null;
    /** Agreed work, or extra on top of it. Everything defaults to agreed. */
    chargeKind?: "proyecto" | "extra";
  }
): Promise<string> {
  const { taxAmount, breakdown } = await computeInvoiceTax(admin, input.businessId, input.subtotal);

  // The holdback is withheld from progress payments, not from the final one —
  // the final invoice is where the withheld money is released, so applying it
  // there would hold the same money back twice.
  const { data: business } = await admin
    .from("businesses")
    .select("holdback_percent")
    .eq("id", input.businessId)
    .single();
  const holdbackPercent = input.type === "final" ? 0 : Number(business?.holdback_percent ?? 0);
  const holdbackAmount = Math.round(input.subtotal * (holdbackPercent / 100) * 100) / 100;

  // The final invoice collects everything held back along the way.
  //
  // Not doing this was a real hole: each progress invoice subtracted its 10%
  // and the final one merely stopped subtracting more, so on a $100,000 job
  // billed 50/25/25 the contractor invoiced $92,500 and never asked for the
  // rest. Nobody would notice from inside the software — every invoice looked
  // right on its own.
  //
  // It carries no tax. The tax was charged on the full value of the work when
  // that work was first invoiced; the holdback only ever delayed the payment
  // of principal, so taxing it here would charge it twice.
  let holdbackReleased = 0;
  if (input.type === "final" && input.projectId) {
    const { data: earlier } = await admin
      .from("invoices")
      .select("holdback_amount, holdback_released")
      .eq("business_id", input.businessId)
      .eq("project_id", input.projectId);
    const withheld = (earlier ?? []).reduce((sum, row) => sum + Number(row.holdback_amount ?? 0), 0);
    const alreadyReleased = (earlier ?? []).reduce((sum, row) => sum + Number(row.holdback_released ?? 0), 0);
    // Subtracting what was already given back keeps this correct even if a
    // project somehow ends up with two closing invoices.
    holdbackReleased = Math.max(0, Math.round((withheld - alreadyReleased) * 100) / 100);
  }

  const { data, error } = await admin
    .from("invoices")
    .insert({
      business_id: input.businessId,
      client_id: input.clientId,
      project_id: input.projectId,
      estimate_id: input.estimateId,
      type: input.type,
      description: input.description,
      subtotal: input.subtotal,
      tax_amount: taxAmount,
      tax_breakdown: breakdown,
      holdback_amount: holdbackAmount,
      holdback_released: holdbackReleased,
      // Tax is charged on the full value of the work; only the payment is
      // reduced by the holdback, which is why it is subtracted last. The
      // release is added after tax for the same reason it carries none.
      amount: Math.round((input.subtotal + taxAmount - holdbackAmount + holdbackReleased) * 100) / 100,
      status: "pendiente",
      due_date: input.dueDate ?? null,
      charge_kind: input.chargeKind ?? "proyecto",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

// Creates (or reuses) the Stripe Checkout Session for an invoice, on the
// business's own connected account. Used by both the business panel
// ("reenviar link") and the client portal ("pagar depósito") — same
// invoice, same session, whoever opens the link pays the same thing.
async function createInvoiceCheckoutSession(
  admin: ReturnType<typeof getSupabaseAdmin>,
  businessId: string,
  invoiceId: string,
  baseUrl: string
): Promise<string> {
  const { data: invoice, error: invoiceError } = await admin
    .from("invoices")
    .select("id, type, amount, description, status, clients(name, email)")
    .eq("business_id", businessId)
    .eq("id", invoiceId)
    .maybeSingle();
  if (invoiceError) throw invoiceError;
  if (!invoice) throw new Error("Factura no encontrada");
  if (invoice.status === "pagado") throw new Error("Esta factura ya está pagada");

  const { data: account, error: accountError } = await admin
    .from("stripe_connected_accounts")
    .select("stripe_account_id, charges_enabled")
    .eq("business_id", businessId)
    .maybeSingle();
  if (accountError) throw accountError;
  if (!account?.stripe_account_id || !account.charges_enabled) {
    throw new Error("El negocio todavía no tiene Stripe conectado y activo");
  }

  const stripe = getStripe();
  const client = invoice.clients as unknown as { name: string; email: string | null } | null;
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "cad",
            unit_amount: Math.round(Number(invoice.amount) * 100),
            product_data: {
              name: `${INVOICE_TYPE_LABEL[invoice.type] ?? "Factura"}${client?.name ? ` — ${client.name}` : ""}`,
              description: invoice.description ?? undefined,
            },
          },
          quantity: 1,
        },
      ],
      customer_email: client?.email ?? undefined,
      success_url: `${baseUrl}/portal?pago=exitoso`,
      cancel_url: `${baseUrl}/portal?pago=cancelado`,
      metadata: { invoiceId: invoice.id, businessId },
    },
    { stripeAccount: account.stripe_account_id }
  );

  await admin.from("invoices").update({ stripe_checkout_session_id: session.id }).eq("id", invoiceId);
  if (!session.url) throw new Error("Stripe no devolvió una URL de pago");
  return session.url;
}

// Stripe fires this on the CONNECTED account's events (since these are
// direct charges) — the webhook endpoint itself still lives on the
// platform, Stripe just tags each event with the originating account id.
// Mounted with express.raw() in `apiApp` below, before the JSON body
// parser, since signature verification needs the exact raw request body.
async function stripeWebhookHandler(req: Request, res: Response) {
  let event;
  try {
    const stripe = getStripe();
    const signature = req.header("stripe-signature");
    if (!signature) throw new Error("Missing stripe-signature header");
    // Tried against each configured secret: the platform scope and the
    // connected-accounts scope have different ones, and an event is genuine
    // if any of them verifies it. Only after all of them fail is it refused.
    //
    // The environment comes first and the ones the server provisioned for
    // itself come after, so a value set by hand always decides.
    const fromEnv = (() => {
      try {
        return getStripeWebhookSecrets();
      } catch {
        return [];
      }
    })();
    const stored = await readStoredWebhookSecrets(getSupabaseAdmin()).catch(() => []);
    const secrets = Array.from(new Set([...fromEnv, ...stored]));
    if (secrets.length === 0) throw new StripeNotConfiguredError();
    let lastError: unknown;
    for (const secret of secrets) {
      try {
        event = stripe.webhooks.constructEvent(req.body, signature, secret);
        break;
      } catch (err) {
        lastError = err;
      }
    }
    if (!event) throw lastError ?? new Error("Invalid signature");
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Invalid signature" });
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as { id: string; metadata?: { invoiceId?: string; businessId?: string }; payment_intent?: string | null; amount_total?: number | null };
    const invoiceId = session.metadata?.invoiceId;
    const businessId = session.metadata?.businessId;
    if (invoiceId && businessId) {
      const admin = getSupabaseAdmin();
      const { data: invoice } = await admin
        .from("invoices")
        .select("id, amount, status, type, project_id")
        .eq("id", invoiceId)
        .eq("business_id", businessId)
        .maybeSingle();
      if (invoice && invoice.status !== "pagado") {
        await admin.from("invoices").update({ status: "pagado", paid_at: new Date().toISOString() }).eq("id", invoiceId);
        await admin.from("payments").insert({
          business_id: businessId,
          invoice_id: invoiceId,
          stripe_payment_id: typeof session.payment_intent === "string" ? session.payment_intent : session.id,
          stripe_event_id: event.id,
          amount: Number(invoice.amount),
          status: "succeeded",
          paid_at: new Date().toISOString(),
        });

        // If this invoice came from a request in the chat, that thread should
        // stop saying "pending" the moment the money lands.
        await markRequestPaidByInvoice(admin, invoiceId);

        // The final payment landing is what closes a job. A deposit or a
        // progress payment does not: there is still work owed.
        if (invoice.type === "final" && invoice.project_id) {
          await advanceAndBill(admin, {
            businessId,
            projectId: invoice.project_id,
            trigger: "factura_final_pagada",
            actor: "cliente",
          });
        }
      }
    }
  }

  // Stripe telling us what it now knows about a contractor's account.
  //
  // Without this the panel only learns the truth when somebody happens to
  // open Settings → Payments and the page asks. That is how a business that
  // had finished its onboarding kept being told it still had to finish:
  // Stripe knew, we did not, and nothing was going to ask. Verification can
  // also complete or lapse days later, with nobody sitting on the page.
  if (event.type === "account.updated") {
    const account = event.data.object as {
      id: string;
      charges_enabled?: boolean;
      payouts_enabled?: boolean;
      details_submitted?: boolean;
      requirements?: { disabled_reason?: string | null } | null;
    };
    const admin = getSupabaseAdmin();
    const status = account.charges_enabled
      ? "active"
      : account.requirements?.disabled_reason
        ? "restricted"
        : "pending";

    // Filtered by the Stripe account id rather than a business: the event
    // arrives from Stripe with no idea which of our tenants it belongs to,
    // and this row is the only place that mapping lives.
    const { error } = await admin
      .from("stripe_connected_accounts")
      .update({
        charges_enabled: !!account.charges_enabled,
        payouts_enabled: !!account.payouts_enabled,
        details_submitted: !!account.details_submitted,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_account_id", account.id);
    if (error) console.error("[stripe] account.updated could not be stored", account.id, error);
  }

  res.json({ received: true });
}

/**
 * Moves a project forward and bills whatever that move just made due.
 *
 * The events a contractor invoices against are the same events that move the
 * job — accepted, started, finished — so keeping these apart would mean
 * remembering to invoice by hand for something the software already knew had
 * happened. Everything that advances a project goes through here instead of
 * calling advanceProject directly.
 */
async function advanceAndBill(
  admin: ReturnType<typeof getSupabaseAdmin>,
  input: Parameters<typeof advanceProject>[1]
): Promise<string | null> {
  const status = await advanceProject(admin, input);
  if (!status) return null;
  const trigger = TRIGGER_FOR_STATUS[status];
  if (trigger) {
    await billMilestonesForTrigger(admin, {
      businessId: input.businessId,
      projectId: input.projectId,
      trigger,
      createInvoice: (args) =>
        createInvoiceRecord(admin, {
          businessId: args.businessId,
          clientId: args.clientId,
          projectId: args.projectId,
          estimateId: args.estimateId,
          type: args.type,
          subtotal: args.subtotal,
          description: args.description,
        }),
    });
  }
  return status;
}

// Wraps a handler so any thrown error (including a missing service-role key)
// becomes a clean JSON response instead of crashing the dev/prod server.
function route(handler: Handler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch((err) => {
      if (err instanceof SupabaseNotConfiguredError || err instanceof StripeNotConfiguredError) {
        res.status(503).json({ error: err.message });
        return;
      }
      next(err);
    });
  };
}

// Lets the browser bootstrap itself at runtime instead of depending on
// VITE_* values baked in at build time. Those are embedded when the bundle is
// compiled, so a hosting panel that injects variables only at run time
// produces a bundle with no Supabase config and a blank, broken app — and
// fixing it needs a full rebuild, not a restart. Serving the same values from
// here means the server's environment is the single source of truth.
//
// The publishable/anon key is designed to be public (it is already inside the
// JS bundle today, and RLS is what actually protects the data), so this
// exposes nothing that wasn't public already. The service-role key is never
// part of this response.
apiRouter.get(
  "/public/config",
  route(async (_req, res) => {
    const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "")
      .trim()
      .replace(/\/rest\/v1\/?$/, "")
      .replace(/\/+$/, "");
    const supabaseAnonKey = readAnonKey();
    res.json({ supabaseUrl, supabaseAnonKey });
  })
);

// Unauthenticated config check. Deliberately reports only whether each piece
// is configured and reachable — never a key, or any part of one — so it is
// safe to open in a browser when a deployment misbehaves.
// The browser's Supabase key has travelled under three names: VITE_ prefixed
// (from when it was compiled into the bundle), SUPABASE_ANON_KEY, and
// SUPABASE_PUBLISHABLE_KEY (what Supabase's dashboard calls it today).
// Accepting all three is what stops a correct key in the wrong variable from
// taking the whole app down.
function readAnonKey(): string {
  const raw =
    process.env.SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    "";
  return raw.replace(/\s+/g, "");
}

apiRouter.get(
  "/health",
  route(async (_req, res) => {
    const report: Record<string, unknown> = {
      supabaseUrlConfigured: Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
      supabaseServiceRoleKeyConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      supabaseAnonKeyConfigured: Boolean(readAnonKey()),
      stripeSecretKeyConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
      stripeWebhookSecretConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    };

    // The project ref is the subdomain, which is already public (the browser
    // bundle contains it) — showing it is what makes a front-end/back-end
    // project mismatch obvious at a glance.
    const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
    report.supabaseProjectRef = rawUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] ?? null;

    // Shape-only facts about the secrets — length and whether they contain
    // whitespace or look like the expected format. Enough to spot a truncated
    // or newline-corrupted paste without ever revealing a key.
    const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    report.serviceRoleKeyLength = rawKey.length;
    report.serviceRoleKeyHasWhitespace = /\s/.test(rawKey);
    report.serviceRoleKeyLooksLikeJwt = rawKey.trim().split(".").length === 3;
    report.serviceRoleKeyLooksLikeSecret = rawKey.trim().startsWith("sb_secret_");
    report.supabaseUrlHasWhitespace = /\s/.test(process.env.SUPABASE_URL ?? "");

    // Same shape-only treatment for the Stripe keys. Both are one paste away
    // from a key that exists, looks plausible and does nothing: Stripe shows
    // the publishable and the secret key side by side on the same page, and
    // the publishable one is the one that copies without a confirmation step.
    const rawStripeKey = (process.env.STRIPE_SECRET_KEY ?? "").trim();
    report.stripeKeyPrefix = rawStripeKey.slice(0, 3) || null;
    report.stripeKeyIsSecret = /^(sk|rk)_/.test(rawStripeKey);
    report.stripeKeyIsPublishable = rawStripeKey.startsWith("pk_");
    report.stripeKeyMode = rawStripeKey.includes("_live_") ? "live" : rawStripeKey.includes("_test_") ? "test" : null;
    const webhookSecrets = (process.env.STRIPE_WEBHOOK_SECRET ?? "")
      .split(",")
      .map((secret) => secret.trim())
      .filter(Boolean);
    report.stripeWebhookSecretCount = webhookSecrets.length;
    report.stripeWebhookSecretLooksRight =
      webhookSecrets.length > 0 && webhookSecrets.every((secret) => secret.startsWith("whsec_"));

    try {
      const admin = getSupabaseAdmin();
      const { error } = await admin.from("businesses").select("id", { head: true, count: "exact" }).limit(1);
      report.supabaseReachable = !error;
      if (error) {
        // A failed fetch surfaces an error whose `message` is often empty, so
        // report every field that might actually carry the reason.
        report.supabaseError = {
          message: error.message || null,
          name: (error as { name?: string }).name ?? null,
          code: (error as { code?: string }).code ?? null,
          hint: (error as { hint?: string }).hint ?? null,
          details: (error as { details?: string }).details ?? null,
        };
      }
    } catch (err) {
      report.supabaseReachable = false;
      report.supabaseError = {
        message: err instanceof Error ? err.message : String(err),
        name: err instanceof Error ? err.name : null,
        cause: err instanceof Error && err.cause ? String(err.cause) : null,
      };
    }

    // Plain-language conclusions, because the raw flags above only help
    // somebody who already knows which variable feeds which behaviour.
    const problems: string[] = [];
    if (!report.supabaseUrlConfigured) problems.push("SUPABASE_URL is not set — the API has no project to talk to.");
    if (!report.supabaseAnonKeyConfigured) {
      problems.push(
        "SUPABASE_ANON_KEY is not set. The browser gets its Supabase config from this server at boot, so without it the app cannot start and shows a configuration error. Set SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY, or SUPABASE_PUBLISHABLE_KEY) to the project's publishable key — the one that starts with sb_publishable_. It is safe to expose; it is designed to ship inside the browser bundle."
      );
    }
    if (!report.supabaseServiceRoleKeyConfigured) {
      problems.push("SUPABASE_SERVICE_ROLE_KEY is not set — every API route that needs admin access will fail.");
    } else if (!report.serviceRoleKeyLooksLikeJwt && !report.serviceRoleKeyLooksLikeSecret) {
      problems.push(
        `SUPABASE_SERVICE_ROLE_KEY does not look like a service role key (${report.serviceRoleKeyLength} characters, and it neither starts with sb_secret_ nor has the three dot-separated parts of a JWT). It looks like the wrong value was pasted. Copy the secret key from Supabase → Project Settings → API keys.`
      );
    }
    if (report.serviceRoleKeyHasWhitespace) {
      problems.push("SUPABASE_SERVICE_ROLE_KEY contains whitespace — it was probably pasted with a line break.");
    }
    // Stripe is optional — a business can run this product without it — so a
    // missing key is not a problem. A key of the wrong kind is: it means
    // somebody meant to set it up and every payment screen will fail.
    if (report.stripeKeyIsPublishable) {
      problems.push(
        "STRIPE_SECRET_KEY holds a publishable key (pk_…). That key can only be used from a browser, so every payment call fails. The secret key is on the same Stripe page, behind the reveal button, and starts with sk_."
      );
    } else if (process.env.STRIPE_SECRET_KEY && !report.stripeKeyIsSecret) {
      problems.push(
        `STRIPE_SECRET_KEY does not look like a Stripe key (starts with "${report.stripeKeyPrefix}"). It should start with sk_ or, for a restricted key, rk_.`
      );
    }
    if (process.env.STRIPE_WEBHOOK_SECRET && !report.stripeWebhookSecretLooksRight) {
      problems.push(
        `STRIPE_WEBHOOK_SECRET holds ${report.stripeWebhookSecretCount} value(s) and not all of them start with whsec_. Signature verification will reject the events signed with the bad one, and those invoices will never be marked paid. Several secrets are allowed, separated by commas — one per Stripe endpoint.`
      );
    }
    if (!report.supabaseReachable && problems.length === 0) {
      problems.push("Supabase is configured but did not answer. The credentials may be revoked, or the project paused.");
    }
    report.problems = problems;
    report.ok = problems.length === 0 && report.supabaseReachable === true;

    res.json(report);
  })
);

// ---------- Auth: registration/provisioning + persona detection ----------
// These run BEFORE requireBusinessAuth is mounted below, since a brand-new
// authenticated user has no users/clients row yet — that's exactly what
// register-business and claim-client create. Fase C intentionally keeps
// registration to email/phone + password only; business name, address,
// license etc. are filled in afterwards in Settings -> Company Data.

// Bootstraps a brand-new Supabase Auth user into a business: creates the
// businesses/business_settings/roles/users rows for them. Service-role is
// the deliberate, narrow exception here — RLS can't self-bootstrap the very
// users row its own current_business_id() policy depends on.
apiRouter.post(
  "/auth/register-business",
  requireAuthenticatedUser,
  route(async (req, res) => {
    const admin = getSupabaseAdmin();

    const { data: existing } = await admin
      .from("users")
      .select("business_id")
      .eq("auth_user_id", req.authUserId!)
      .maybeSingle();
    if (existing) {
      res.json({ businessId: existing.business_id });
      return;
    }

    const { data: authUser } = await admin.auth.admin.getUserById(req.authUserId!);
    const email = authUser.user?.email ?? null;
    const phone = authUser.user?.phone ?? null;
    const label = email ? email.split("@")[0] : phone ?? "nuevo";
    const businessName = `Negocio de ${label}`;
    const slug = await generateUniqueSlug(admin, businessName);

    const { data: business, error: businessError } = await admin
      .from("businesses")
      .insert({ name: businessName, slug })
      .select("id")
      .single();
    if (businessError) throw businessError;

    const [, roleResult] = await Promise.all([
      admin.from("business_settings").insert({ business_id: business.id }),
      admin.from("roles").insert({ business_id: business.id, name: "admin" }).select("id").single(),
    ]);
    if (roleResult.error) throw roleResult.error;

    const { error: userError } = await admin.from("users").insert({
      business_id: business.id,
      auth_user_id: req.authUserId!,
      name: label,
      email,
      phone,
      role_id: roleResult.data.id,
    });
    if (userError) throw userError;

    res.status(201).json({ businessId: business.id });
  })
);

apiRouter.post(
  "/public/auth/send-registration-otp",
  route(async (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      res.status(400).json({ error: "Email y contraseña requeridos" });
      return;
    }

    try {
      const result = await sendRegistrationOTP(String(email), String(password));
      res.status(200).json({ success: true, needsCode: true, codeSent: result.codeSent });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  })
);

apiRouter.post(
  "/public/auth/verify-registration-otp",
  route(async (req, res) => {
    const { email, code } = req.body ?? {};
    if (!email || !code) {
      res.status(400).json({ error: "Email y código de 8 dígitos requeridos" });
      return;
    }

    try {
      const result = await verifyRegistrationOTP(String(email), String(code));
      res.status(200).json({ success: true, businessId: result.businessId, authUserId: result.authUserId });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  })
);

// Links a brand-new Supabase Auth user to an existing clients row (created
// by a business through CRM) by matching email or phone. The client never
// creates new data at signup — their project/estimate already exists,
// they're just claiming access to view it.
apiRouter.post(
  "/auth/claim-client",
  requireAuthenticatedUser,
  route(async (req, res) => {
    const admin = getSupabaseAdmin();

    const { data: existing } = await admin
      .from("clients")
      .select("id")
      .eq("auth_user_id", req.authUserId!)
      .maybeSingle();
    if (existing) {
      res.json({ clientId: existing.id });
      return;
    }

    const { data: authUser } = await admin.auth.admin.getUserById(req.authUserId!);
    const email = authUser.user?.email ?? null;
    const phone = authUser.user?.phone ?? null;
    if (!email && !phone) {
      res.status(400).json({ error: "No email or phone on this account" });
      return;
    }

    let query = admin.from("clients").select("id").is("auth_user_id", null);
    query = email && phone ? query.or(`email.eq.${email},phone.eq.${phone}`) : query.eq(email ? "email" : "phone", email ?? phone!);
    const { data: matches, error: matchError } = await query.order("created_at", { ascending: true }).limit(1);
    if (matchError) throw matchError;

    if (!matches || matches.length === 0) {
      res.status(404).json({
        error: "No encontramos ningún cliente con ese correo o teléfono. Pídele a tu contratista que te dé de alta primero.",
      });
      return;
    }

    const { error: updateError } = await admin
      .from("clients")
      .update({ auth_user_id: req.authUserId! })
      .eq("id", matches[0].id);
    if (updateError) throw updateError;

    res.status(201).json({ clientId: matches[0].id });
  })
);

// Called right after any login to decide where to redirect: business panel,
// client portal, or "finish setting up your account".
apiRouter.get(
  "/auth/me",
  requireAuthenticatedUser,
  route(async (req, res) => {
    const admin = getSupabaseAdmin();
    const [userRow, clientRow] = await Promise.all([
      admin.from("users").select("business_id").eq("auth_user_id", req.authUserId!).maybeSingle(),
      admin.from("clients").select("id").eq("auth_user_id", req.authUserId!).maybeSingle(),
    ]);

    if (userRow.data) {
      res.json({ persona: "business", businessId: userRow.data.business_id });
    } else if (clientRow.data) {
      res.json({ persona: "client", clientId: clientRow.data.id });
    } else {
      res.json({ persona: "none" });
    }
  })
);

// ---------- Worker PWA access (token-based, no Supabase Auth at all) ----------

apiRouter.post(
  "/worker-auth/login",
  route(async (req, res) => {
    const token = (req.body?.token ?? "").trim();
    if (!token) {
      res.status(400).json({ error: "token is required" });
      return;
    }
    const hash = hashToken(token);
    const admin = getSupabaseAdmin();

    const [employee, subcontractor] = await Promise.all([
      admin.from("employees").select("id, name, business_id").eq("access_token_hash", hash).maybeSingle(),
      admin.from("subcontractors").select("id, name, business_id").eq("access_token_hash", hash).maybeSingle(),
    ]);

    // Same distinction as requireWorkerAuth: "we could not ask" must never
    // reach a worker as "your code is wrong". They would spend the morning
    // hunting for a card that was fine all along.
    if (employee.error && subcontractor.error) {
      console.error("[worker-auth] lookup failed", employee.error);
      res.status(503).json({ error: "Servicio no disponible", code: "backend_unavailable" });
      return;
    }

    const worker = employee.data ?? subcontractor.data;
    if (!worker) {
      res.status(401).json({ error: "Código inválido" });
      return;
    }

    res.json({
      id: worker.id,
      name: worker.name,
      businessId: worker.business_id,
      kind: employee.data ? "employee" : "subcontractor",
    });
  })
);

// Client Portal passwordless login: same shape as worker-auth/login above.
// The client types the code their contractor gave them — no email, no
// password, nothing to receive or wait for.
apiRouter.post(
  "/client-auth/login",
  route(async (req, res) => {
    const token = (req.body?.token ?? "").trim();
    if (!token) {
      res.status(400).json({ error: "token is required" });
      return;
    }
    const admin = getSupabaseAdmin();
    const { data: client, error } = await admin
      .from("clients")
      .select("id, name, business_id")
      .eq("access_token_hash", hashToken(token))
      .maybeSingle();

    if (error) {
      console.error("[client-auth] lookup failed", error);
      res.status(503).json({ error: "Servicio no disponible", code: "backend_unavailable" });
      return;
    }

    if (!client) {
      res.status(401).json({ error: "Código inválido" });
      return;
    }

    res.json({ id: client.id, name: client.name, businessId: client.business_id });
  })
);

// Everything below is scoped to the calling worker (employee or
// subcontractor) via requireWorkerAuth, which resolves req.workerId /
// req.workerKind / req.workerBusinessId from the raw token — there's no
// auth.uid() in this flow, so every query filters manually instead of
// relying on RLS.
function workerColumn(req: Request): "assigned_employee_id" | "assigned_subcontractor_id" {
  return req.workerKind === "employee" ? "assigned_employee_id" : "assigned_subcontractor_id";
}

apiRouter.get(
  "/worker/schedule",
  requireWorkerAuth,
  route(async (req, res) => {
    const admin = getSupabaseAdmin();
    const column = workerColumn(req);

    const [events, workOrders] = await Promise.all([
      admin
        .from("schedule_events")
        .select("id, title, type, start_time, end_time, notes, project_id, projects(name)")
        .eq("business_id", req.workerBusinessId!)
        .eq(column, req.workerId!)
        .order("start_time"),
      admin
        .from("work_orders")
        .select("id, title, description, priority, status, project_id, projects(name)")
        .eq("business_id", req.workerBusinessId!)
        .eq(column, req.workerId!)
        .neq("status", "completada"),
    ]);

    if (events.error) throw events.error;
    if (workOrders.error) throw workOrders.error;

    res.json({
      events: events.data.map((e: any) => ({
        id: e.id,
        title: e.title,
        type: e.type,
        startTime: e.start_time,
        endTime: e.end_time,
        notes: e.notes,
        projectId: e.project_id,
        projectName: e.projects?.name ?? null,
      })),
      workOrders: workOrders.data.map((w: any) => ({
        id: w.id,
        title: w.title,
        description: w.description,
        priority: w.priority,
        status: w.status,
        projectId: w.project_id,
        projectName: w.projects?.name ?? null,
      })),
    });
  })
);

apiRouter.get(
  "/worker/projects",
  requireWorkerAuth,
  route(async (req, res) => {
    const admin = getSupabaseAdmin();
    const column = req.workerKind === "employee" ? "employee_id" : "subcontractor_id";
    const assignedColumn = req.workerKind === "employee" ? "assigned_employee_id" : "assigned_subcontractor_id";

    // A worker can clock into any project they are actually attached to, and
    // there are three ways to be attached: a formal assignment, a job on the
    // calendar, or a work order. Reading only `assignments` meant a project
    // created by accepting an estimate — which schedules work but writes no
    // assignment — was invisible to the very people scheduled on it.
    const [assignments, events, orders] = await Promise.all([
      admin
        .from("assignments")
        .select("projects(id, name, status)")
        .eq("business_id", req.workerBusinessId!)
        .eq(column, req.workerId!),
      admin
        .from("schedule_events")
        .select("projects(id, name, status)")
        .eq("business_id", req.workerBusinessId!)
        .eq(assignedColumn, req.workerId!),
      admin
        .from("work_orders")
        .select("projects(id, name, status)")
        .eq("business_id", req.workerBusinessId!)
        .eq(assignedColumn, req.workerId!),
    ]);
    if (assignments.error) throw assignments.error;
    if (events.error) throw events.error;
    if (orders.error) throw orders.error;

    // Finished and paused jobs come off the clock-in list. A worker scrolling
    // past last spring's kitchen to find today's site is how hours end up
    // booked to the wrong project, and those hours become an invoice.
    const CLOCKABLE = new Set(["planificacion", "en_progreso", "confirmado"]);

    const seen = new Set<string>();
    const projects = [];
    for (const row of [...(assignments.data as any[]), ...(events.data as any[]), ...(orders.data as any[])]) {
      if (row.projects && !seen.has(row.projects.id) && CLOCKABLE.has(row.projects.status)) {
        seen.add(row.projects.id);
        projects.push({ id: row.projects.id, name: row.projects.name });
      }
    }
    res.json(projects);
  })
);

apiRouter.get(
  "/worker/time-entries/active",
  requireWorkerAuth,
  route(async (req, res) => {
    const admin = getSupabaseAdmin();
    const column = req.workerKind === "employee" ? "employee_id" : "subcontractor_id";

    const { data, error } = await admin
      .from("time_entries")
      .select("id, project_id, projects(name), check_in_time, billable, service_type")
      .eq("business_id", req.workerBusinessId!)
      .eq(column, req.workerId!)
      .is("check_out_time", null)
      .order("check_in_time", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;

    res.json(
      data
        ? {
            id: data.id,
            projectId: data.project_id,
            projectName: (data as any).projects?.name ?? null,
            checkInTime: data.check_in_time,
            billable: data.billable,
            serviceType: data.service_type,
          }
        : null
    );
  })
);

apiRouter.post(
  "/worker/time-entries/check-in",
  requireWorkerAuth,
  route(async (req, res) => {
    const { projectId, billable, serviceType, latitude, longitude } = req.body ?? {};
    if (!projectId || latitude === undefined || longitude === undefined) {
      res.status(400).json({ error: "projectId, latitude and longitude are required" });
      return;
    }

    const admin = getSupabaseAdmin();
    const column = req.workerKind === "employee" ? "employee_id" : "subcontractor_id";

    const { data, error } = await admin
      .from("time_entries")
      .insert({
        business_id: req.workerBusinessId!,
        project_id: projectId,
        [column]: req.workerId!,
        billable: billable ?? true,
        service_type: serviceType ?? null,
        check_in_location: `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`,
        check_in_lat: latitude,
        check_in_lng: longitude,
      })
      .select("id, check_in_time")
      .single();
    if (error) throw error;

    await admin.from("gps_pings").insert({
      business_id: req.workerBusinessId!,
      [column]: req.workerId!,
      latitude,
      longitude,
      timestamp: new Date().toISOString(),
    });

    // Somebody standing on the site is the strongest evidence there is that
    // the job left planning, so the first check-in moves it — nobody in the
    // office has to remember to.
    await advanceAndBill(admin, {
      businessId: req.workerBusinessId!,
      projectId,
      trigger: "primer_fichaje",
      actor: "trabajador",
    });

    res.status(201).json({ id: data.id, checkInTime: data.check_in_time });
  })
);

apiRouter.post(
  "/worker/time-entries/:id/check-out",
  requireWorkerAuth,
  route(async (req, res) => {
    const { latitude, longitude } = req.body ?? {};
    if (latitude === undefined || longitude === undefined) {
      res.status(400).json({ error: "latitude and longitude are required" });
      return;
    }

    const admin = getSupabaseAdmin();
    const column = req.workerKind === "employee" ? "employee_id" : "subcontractor_id";

    // Past the eighth hour of the day the shift is cut in two: the ordinary
    // part ends there and an overtime entry carries on.
    const { overtimeEntryId } = await closeEntryWithOvertime(admin, {
      businessId: req.workerBusinessId!,
      entryId: req.params.id,
      checkOutTime: new Date(),
      location: `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`,
      latitude,
      longitude,
    });

    await admin.from("gps_pings").insert({
      business_id: req.workerBusinessId!,
      [column]: req.workerId!,
      latitude,
      longitude,
      timestamp: new Date().toISOString(),
    });

    res.json({ ok: true, overtimeEntryId });
  })
);

apiRouter.get(
  "/worker/time-entries/history",
  requireWorkerAuth,
  route(async (req, res) => {
    const admin = getSupabaseAdmin();
    const column = req.workerKind === "employee" ? "employee_id" : "subcontractor_id";

    const { data, error } = await admin
      .from("time_entries")
      .select(
        "id, project_id, projects(name), check_in_time, check_out_time, check_in_location, check_out_location, check_in_lat, check_in_lng, check_out_lat, check_out_lng, billable, service_type, overtime"
      )
      .eq("business_id", req.workerBusinessId!)
      .eq(column, req.workerId!)
      .not("check_out_time", "is", null)
      .order("check_in_time", { ascending: false })
      .limit(10);
    if (error) throw error;

    res.json(
      (data ?? []).map((row: any) => ({
        id: row.id,
        projectId: row.project_id,
        projectName: row.projects?.name ?? null,
        checkInTime: row.check_in_time,
        checkOutTime: row.check_out_time,
        checkInLocation: row.check_in_location,
        checkOutLocation: row.check_out_location,
        checkInLat: row.check_in_lat,
        checkInLng: row.check_in_lng,
        checkOutLat: row.check_out_lat,
        checkOutLng: row.check_out_lng,
        billable: row.billable,
        serviceType: row.service_type,
        overtime: row.overtime,
      }))
    );
  })
);

// Closes the active entry and opens a new one against a different project
// in a single action, so the worker doesn't have to check out then in again.
apiRouter.post(
  "/worker/time-entries/switch-project",
  requireWorkerAuth,
  route(async (req, res) => {
    const { activeEntryId, projectId, billable, serviceType, latitude, longitude } = req.body ?? {};
    if (!activeEntryId || !projectId || latitude === undefined || longitude === undefined) {
      res.status(400).json({ error: "activeEntryId, projectId, latitude and longitude are required" });
      return;
    }

    const admin = getSupabaseAdmin();
    const column = req.workerKind === "employee" ? "employee_id" : "subcontractor_id";
    const locationStr = `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`;

    await closeEntryWithOvertime(admin, {
      businessId: req.workerBusinessId!,
      entryId: activeEntryId,
      checkOutTime: new Date(),
      location: locationStr,
      latitude,
      longitude,
    });

    const { data, error: openError } = await admin
      .from("time_entries")
      .insert({
        business_id: req.workerBusinessId!,
        project_id: projectId,
        [column]: req.workerId!,
        billable: billable ?? true,
        service_type: serviceType ?? null,
        check_in_location: locationStr,
        check_in_lat: latitude,
        check_in_lng: longitude,
      })
      .select("id, check_in_time")
      .single();
    if (openError) throw openError;

    await advanceAndBill(admin, {
      businessId: req.workerBusinessId!,
      projectId,
      trigger: "primer_fichaje",
      actor: "trabajador",
    });

    res.status(201).json({ id: data.id, checkInTime: data.check_in_time });
  })
);

// ---------- Worker chat (unified system, worker side) ----------
// Uses the service-role client throughout, same as the rest of the worker
// routes above — there's no auth.uid() in this flow, so every query filters
// manually by req.workerId/req.workerKind instead of relying on RLS.

apiRouter.get(
  "/worker/chat/channels",
  requireWorkerAuth,
  route(async (req, res) => {
    const admin = getSupabaseAdmin();
    const [{ data, error }, { data: business }] = await Promise.all([
      admin
        .from("chat_channels")
        .select("id, label, status, disappearing_duration, pinned, archived, created_at")
        .eq("business_id", req.workerBusinessId!)
        .eq("participant_type", req.workerKind!)
        .eq("participant_id", req.workerId!)
        .order("created_at", { ascending: false }),
      admin.from("businesses").select("name").eq("id", req.workerBusinessId!).maybeSingle(),
    ]);
    if (error) throw error;

    const channelIds = data.map((c) => c.id);
    const { data: lastMessages, error: lastMessagesError } = channelIds.length
      ? await admin
          .from("chat_messages")
          .select("channel_id, content, created_at")
          .in("channel_id", channelIds)
          .order("created_at", { ascending: false })
      : { data: [] as any[], error: null };
    if (lastMessagesError) throw lastMessagesError;

    res.json(
      data.map((c) => ({
        id: c.id,
        label: c.label,
        status: c.status,
        disappearingDuration: c.disappearing_duration,
        pinned: c.pinned,
        archived: c.archived,
        participantName: business?.name ?? "Negocio",
        lastMessage: (lastMessages as any[]).find((m) => m.channel_id === c.id)?.content ?? null,
      }))
    );
  })
);

// Flips an invitation to active — required before the worker can send or
// receive anything on that channel.
apiRouter.post(
  "/worker/chat/channels/:id/accept",
  requireWorkerAuth,
  route(async (req, res) => {
    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from("chat_channels")
      .update({ status: "activo" })
      .eq("business_id", req.workerBusinessId!)
      .eq("participant_type", req.workerKind!)
      .eq("participant_id", req.workerId!)
      .eq("id", req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  })
);

apiRouter.get(
  "/worker/chat/channels/:id/messages",
  requireWorkerAuth,
  route(async (req, res) => {
    const admin = getSupabaseAdmin();
    const { data: channel } = await admin
      .from("chat_channels")
      .select("id")
      .eq("business_id", req.workerBusinessId!)
      .eq("participant_type", req.workerKind!)
      .eq("participant_id", req.workerId!)
      .eq("id", req.params.id)
      .maybeSingle();
    if (!channel) {
      res.status(404).json({ error: "Chat no encontrado" });
      return;
    }
    await purgeExpiredMessages(admin, channel.id);
    const { data, error } = await admin
      .from("chat_messages")
      .select("id, sender_type, content, created_at, attachment_kind, attachment_id, attachment_name, attachment_mime")
      .eq("channel_id", channel.id)
      .order("created_at");
    if (error) throw error;
    res.json(data.map(toChatMessage));
  })
);

apiRouter.post(
  "/worker/chat/channels/:id/messages",
  requireWorkerAuth,
  route(async (req, res) => {
    const content = String(req.body?.content ?? "").trim();
    if (!content) {
      res.status(400).json({ error: "content is required" });
      return;
    }
    const admin = getSupabaseAdmin();
    const { data: channel } = await admin
      .from("chat_channels")
      .select("id, status, disappearing_duration")
      .eq("business_id", req.workerBusinessId!)
      .eq("participant_type", req.workerKind!)
      .eq("participant_id", req.workerId!)
      .eq("id", req.params.id)
      .maybeSingle();
    if (!channel) {
      res.status(404).json({ error: "Chat no encontrado" });
      return;
    }
    if (channel.status !== "activo") {
      res.status(403).json({ error: "Acepta la invitación antes de escribir" });
      return;
    }

    const { data, error } = await admin
      .from("chat_messages")
      .insert({
        channel_id: channel.id,
        business_id: req.workerBusinessId!,
        sender_type: req.workerKind!,
        sender_id: req.workerId!,
        content,
        expires_at: computeExpiresAt(channel.disappearing_duration),
      })
      .select("id, sender_type, content, created_at, attachment_kind, attachment_id, attachment_name, attachment_mime")
      .single();
    if (error) throw error;
    res.status(201).json({
      id: data.id,
      senderType: data.sender_type,
      content: data.content,
      timestamp: data.created_at,
      attachment: data.attachment_kind
        ? { kind: data.attachment_kind, id: data.attachment_id, name: data.attachment_name, mime: data.attachment_mime }
        : null,
    });
  })
);

// ---------- Client Portal (self-service, client-authenticated) ----------

apiRouter.get(
  "/client-portal/me",
  requireClientAuth,
  route(async (req, res) => {
    const supabase = req.supabase!;
    const clientId = req.clientId!;

    const [client, project, estimate, pendingInvoice] = await Promise.all([
      supabase.from("clients").select("id, name").eq("id", clientId).single(),
      supabase
        .from("projects")
        .select("id, name, progress_percent, business_id, status")
        .eq("client_id", clientId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("estimates")
        .select("id, status, total")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("invoices")
        .select("id, type, amount, status")
        .eq("client_id", clientId)
        .neq("status", "pagado")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (client.error) throw client.error;
    if (project.error) throw project.error;
    if (estimate.error) throw estimate.error;
    if (pendingInvoice.error) throw pendingInvoice.error;

    // What they signed, so the portal can show it back instead of offering to
    // sign something already signed.
    const { data: signature } = estimate.data
      ? await getSupabaseAdmin()
          .from("estimate_signatures")
          .select("signed_name, signed_at, signed_total")
          .eq("estimate_id", estimate.data.id)
          .order("signed_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

    let visiblePhotos: { id: string }[] = [];
    if (project.data) {
      const { data, error } = await supabase
        .from("photos")
        .select("id")
        .eq("project_id", project.data.id)
        .eq("visible_to_client", true);
      if (error) throw error;
      visiblePhotos = data;
    }

    // "How is my renovation going" is the question the portal exists to
    // answer, and a percentage nobody maintains is not an answer. The customer
    // sees the same derived checklist the contractor does — and the payment
    // schedule with it, because "what do I still owe and when" is the other
    // half of why they open this page.
    const admin = getSupabaseAdmin();
    // A request whose day has come goes out now: the customer is right here,
    // which is exactly when it wants to be seen.
    if (project.data?.business_id) {
      await sweepDueRequests(admin, project.data.business_id, paymentRequestDeps(admin));
    }

    const [lifecycle, milestones] = project.data
      ? await Promise.all([
          lifecycleSnapshot(admin, project.data.business_id, project.data.id),
          admin
            .from("project_payment_milestones")
            .select("id, position, label, percent, invoice_id, billed_at, invoices(amount, status, due_date)")
            .eq("project_id", project.data.id)
            .order("position"),
        ])
      : [null, { data: [] as unknown[] }];

    const paymentSchedule = ((milestones as { data: unknown[] }).data ?? []).map((row) => {
      const m = row as Record<string, unknown>;
      const invoice = m.invoices as { amount: number; status: string; due_date: string | null } | null;
      return {
        id: String(m.id),
        position: Number(m.position),
        label: String(m.label),
        percent: Number(m.percent),
        // Only a billed stage has a real figure. Showing a projected amount
        // for an unbilled one would put a number in front of the customer
        // that nobody has agreed to yet.
        amount: invoice ? Number(invoice.amount) : null,
        status: invoice?.status ?? null,
        dueDate: invoice?.due_date ?? null,
        invoiceId: (m.invoice_id as string | null) ?? null,
      };
    });

    res.json({
      client: { id: client.data.id, name: client.data.name },
      project: project.data
        ? {
            id: project.data.id,
            name: project.data.name,
            progressPercent: Number(project.data.progress_percent),
            status: project.data.status,
            lifecycle,
            paymentSchedule,
          }
        : null,
      estimate: estimate.data
        ? {
            id: estimate.data.id,
            status: estimate.data.status,
            total: Number(estimate.data.total),
            signature: signature
              ? { name: signature.signed_name, signedAt: signature.signed_at, total: Number(signature.signed_total) }
              : null,
          }
        : null,
      pendingInvoice: pendingInvoice.data
        ? { id: pendingInvoice.data.id, type: pendingInvoice.data.type, amount: Number(pendingInvoice.data.amount), status: pendingInvoice.data.status }
        : null,
      visiblePhotos,
    });
  })
);

// Client-side payment: the invoice already exists (the admin created it
// from Invoicing.tsx) — this only ever creates the Stripe Checkout Session
// for it, on the business's own connected account. RLS on the initial read
// is what proves this invoice really belongs to the calling client before
// the admin client is trusted to act on it.
apiRouter.post(
  "/client/invoices/:id/checkout",
  requireClientAuth,
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data: invoice, error } = await supabase
      .from("invoices")
      .select("id, business_id")
      .eq("id", req.params.id)
      .eq("client_id", req.clientId!)
      .maybeSingle();
    if (error) throw error;
    if (!invoice) {
      res.status(404).json({ error: "Factura no encontrada" });
      return;
    }

    const admin = getSupabaseAdmin();
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    try {
      const url = await createInvoiceCheckoutSession(admin, invoice.business_id, invoice.id, baseUrl);
      res.json({ url });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "No se pudo crear el link de pago" });
    }
  })
);

// ---------- Client chat (unified system, client side) ----------
// Unlike the worker routes, clients do have auth.uid() — req.supabase is
// their own RLS-scoped client, backed by the client_own_channels /
// client_own_messages / client_insert_own_messages policies added
// alongside chat_channels/chat_messages. Only ever the 'interno' system:
// a client who hasn't been approved yet has no account to authenticate
// with in the first place (see ensureClientAccount above).

apiRouter.get(
  "/client/chat/channels",
  requireClientAuth,
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("chat_channels")
      .select("id, business_id, status, control_mode, disappearing_duration, created_at")
      .eq("participant_type", "client")
      .eq("participant_id", req.clientId!)
      .eq("system", "interno")
      .order("created_at", { ascending: false });
    if (error) throw error;

    // Clients have no RLS visibility into `businesses` (only staff do), so the
    // business's display name is looked up separately via the service role.
    const businessIds = Array.from(new Set(data.map((c) => c.business_id)));
    const { data: businesses } = businessIds.length
      ? await getSupabaseAdmin().from("businesses").select("id, name").in("id", businessIds)
      : { data: [] as { id: string; name: string }[] };

    res.json(
      data.map((c) => ({
        id: c.id,
        status: c.status,
        controlMode: c.control_mode,
        disappearingDuration: c.disappearing_duration,
        participantName: businesses?.find((b) => b.id === c.business_id)?.name ?? "Negocio",
      }))
    );
  })
);

apiRouter.get(
  "/client/chat/channels/:id/messages",
  requireClientAuth,
  route(async (req, res) => {
    const supabase = req.supabase!;
    // Ownership is checked in application code rather than left to RLS,
    // because a client authenticated by access code has no auth.uid() and
    // therefore runs through the service-role client.
    const { data: owned } = await supabase
      .from("chat_channels")
      .select("id")
      .eq("id", req.params.id)
      .eq("participant_type", "client")
      .eq("participant_id", req.clientId!)
      .maybeSingle();
    if (!owned) {
      res.status(404).json({ error: "Chat no encontrado" });
      return;
    }
    await purgeExpiredMessages(supabase, req.params.id);
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, sender_type, content, created_at, attachment_kind, attachment_id, attachment_name, attachment_mime")
      .eq("channel_id", req.params.id)
      .order("created_at");
    if (error) throw error;
    res.json(await withInvoiceState(getSupabaseAdmin(), data.map(toChatMessage)));
  })
);

apiRouter.post(
  "/client/chat/channels/:id/messages",
  requireClientAuth,
  route(async (req, res) => {
    const content = String(req.body?.content ?? "").trim();
    if (!content) {
      res.status(400).json({ error: "content is required" });
      return;
    }
    const supabase = req.supabase!;
    const { data: channel, error: channelError } = await supabase
      .from("chat_channels")
      .select("id, business_id, disappearing_duration")
      .eq("id", req.params.id)
      .eq("participant_type", "client")
      .eq("participant_id", req.clientId!)
      .maybeSingle();
    if (channelError) throw channelError;
    if (!channel) {
      res.status(404).json({ error: "Chat no encontrado" });
      return;
    }

    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        channel_id: channel.id,
        business_id: channel.business_id,
        sender_type: "client",
        sender_id: req.clientId!,
        content,
        expires_at: computeExpiresAt(channel.disappearing_duration),
      })
      .select("id, sender_type, content, created_at, attachment_kind, attachment_id, attachment_name, attachment_mime")
      .single();
    if (error) throw error;
    res.status(201).json({
      id: data.id,
      senderType: data.sender_type,
      content: data.content,
      timestamp: data.created_at,
      attachment: data.attachment_kind
        ? { kind: data.attachment_kind, id: data.attachment_id, name: data.attachment_name, mime: data.attachment_mime }
        : null,
    });
  })
);

// ---------- Public business chat (/c/[slug]) ----------
// No authentication of any kind — accessible by anyone with the link.
// Uses the service-role client throughout since there's no auth.uid() to
// let RLS scope anything; every query filters manually by business_id
// (resolved from the slug) or conversation_id, same pattern as the
// worker-auth routes above.

apiRouter.get(
  "/public/businesses/:slug",
  route(async (req, res) => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("businesses")
      .select("id, name")
      .eq("slug", req.params.slug)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: "No encontramos ese negocio" });
      return;
    }
    res.json({ id: data.id, name: data.name });
  })
);

// A visitor landing on /c/[slug]: creates a placeholder clients row (name
// filled in later by the button flow itself, lead_status 'nuevo', no
// Supabase Auth account yet — see ensureClientAccount above for when that
// account gets created) plus the chat_channel (system 'publico') they'll
// chat in, and immediately posts the flow's welcome message so there's
// something to show the moment the page opens. The "conversationId" the
// frontend gets back is really this channel's id — kept under the old
// field name so the already-shipped public chat page didn't need to change.
apiRouter.post(
  "/public/businesses/:slug/leads",
  route(async (req, res) => {
    const lang = normalizeFlowLang(req.body?.lang);
    const admin = getSupabaseAdmin();
    const { data: business, error: businessError } = await admin
      .from("businesses")
      .select("id, name")
      .eq("slug", req.params.slug)
      .maybeSingle();
    if (businessError) throw businessError;
    if (!business) {
      res.status(404).json({ error: "No encontramos ese negocio" });
      return;
    }

    const { data: client, error: clientError } = await admin
      .from("clients")
      .insert({ business_id: business.id, name: "Visitante", lead_status: "nuevo", source: "link_publico" })
      .select("id")
      .single();
    if (clientError) throw clientError;

    const { data: channel, error: channelError } = await admin
      .from("chat_channels")
      .insert({
        business_id: business.id,
        system: "publico",
        label: "cliente",
        participant_type: "client",
        participant_id: client.id,
        status: "activo",
        control_mode: "bot",
        flow_state: { step: "welcome", answers: {}, lang },
      })
      .select("id")
      .single();
    if (channelError) throw channelError;

    await admin.from("chat_messages").insert({
      channel_id: channel.id,
      business_id: business.id,
      sender_type: "bot",
      content: flowBotMessage("welcome", business.name, [], {}, lang),
    });

    res.status(201).json({ businessId: business.id, clientId: client.id, conversationId: channel.id });
  })
);

// Current step of the button flow for this conversation — the frontend
// calls this on load/reload to know which control to render underneath the
// (already-posted) latest bot message.
apiRouter.get(
  "/public/conversations/:id/flow",
  route(async (req, res) => {
    const admin = getSupabaseAdmin();
    const { data: channel, error } = await admin
      .from("chat_channels")
      .select("business_id, control_mode, flow_state")
      .eq("id", req.params.id)
      .maybeSingle();
    if (error) throw error;
    if (!channel) {
      res.status(404).json({ error: "Conversación no encontrada" });
      return;
    }

    const { data: categories } = await admin
      .from("budget_categories")
      .select("id, name")
      .eq("business_id", channel.business_id)
      .order("name");

    const step = (channel.flow_state as any)?.step ?? "welcome";
    const lang = normalizeFlowLang((channel.flow_state as any)?.lang);
    res.json({ controlMode: channel.control_mode, ...flowStepView(step, categories ?? [], lang) });
  })
);

// Records the answer for the current step, advances to the next one, and
// posts both the visitor's echoed answer and the next bot prompt into the
// same transcript everyone already reads. On the last step, files the
// collected answers as a real bot-drafted estimate.
apiRouter.post(
  "/public/conversations/:id/flow/answer",
  route(async (req, res) => {
    const value = String(req.body?.value ?? "").trim();
    if (!value) {
      res.status(400).json({ error: "value is required" });
      return;
    }
    const admin = getSupabaseAdmin();
    const { data: channel, error } = await admin
      .from("chat_channels")
      .select("id, business_id, participant_id, flow_state, disappearing_duration, businesses(name)")
      .eq("id", req.params.id)
      .maybeSingle();
    if (error) throw error;
    if (!channel) {
      res.status(404).json({ error: "Conversación no encontrada" });
      return;
    }

    const businessName = (channel.businesses as any)?.name ?? "el negocio";
    const { data: categories } = await admin
      .from("budget_categories")
      .select("id, name")
      .eq("business_id", channel.business_id)
      .order("name");
    const categoryList: FlowCategory[] = categories ?? [];

    const currentStep = ((channel.flow_state as any)?.step ?? "welcome") as FlowStepId;
    const answers = { ...((channel.flow_state as any)?.answers ?? {}) } as Record<string, string>;
    // The visitor can switch languages mid-flow; the newest choice wins and
    // is persisted, so every later bot message matches what they're reading.
    const lang = normalizeFlowLang(req.body?.lang ?? (channel.flow_state as any)?.lang);

    if (currentStep === "done") {
      res.json({ controlMode: null, ...flowStepView("done", categoryList, lang) });
      return;
    }

    // Echo what the visitor picked/typed as their own chat bubble — for a
    // button step this is the option's label, not its raw id/value.
    const view = flowStepView(currentStep, categoryList, lang);
    const echoLabel =
      view.kind === "buttons" || view.kind === "button"
        ? view.options.find((o) => o.value === value)?.label ?? value
        : value;
    await admin.from("chat_messages").insert({
      channel_id: channel.id,
      business_id: channel.business_id,
      sender_type: "client",
      content: echoLabel,
      expires_at: computeExpiresAt(channel.disappearing_duration),
    });

    const field = FLOW_FIELD[currentStep];
    if (field) answers[field] = value;

    const newStep = nextFlowStep(currentStep, categoryList.length > 0);

    if (newStep === "done") {
      await createBotEstimate(admin, channel.business_id, channel.participant_id!, answers);
      const clientUpdate: Record<string, string> = {};
      if (answers.name) clientUpdate.name = answers.name;
      if (answers.phone) clientUpdate.phone = answers.phone;
      if (answers.email) clientUpdate.email = answers.email;
      if (answers.address) clientUpdate.address = answers.address;
      if (Object.keys(clientUpdate).length > 0) {
        await admin.from("clients").update(clientUpdate).eq("id", channel.participant_id!);
      }
    }

    await admin.from("chat_channels").update({ flow_state: { step: newStep, answers, lang } }).eq("id", channel.id);
    await admin.from("chat_messages").insert({
      channel_id: channel.id,
      business_id: channel.business_id,
      sender_type: "bot",
      content: flowBotMessage(newStep, businessName, categoryList, answers, lang),
      expires_at: computeExpiresAt(channel.disappearing_duration),
    });

    res.json({ controlMode: null, ...flowStepView(newStep, categoryList, lang) });
  })
);

// Below: possessing the channel id is the credential (nobody but the
// visitor who just created it knows it), the same trust model as any share
// link. Every query still scopes explicitly by channel id.
apiRouter.get(
  "/public/conversations/:id/messages",
  route(async (req, res) => {
    const admin = getSupabaseAdmin();
    await purgeExpiredMessages(admin, req.params.id);
    const { data, error } = await admin
      .from("chat_messages")
      .select("id, sender_type, content, created_at, attachment_kind, attachment_id, attachment_name, attachment_mime")
      .eq("channel_id", req.params.id)
      .order("created_at");
    if (error) throw error;
    res.json(
      data.map((m) => ({
        id: m.id,
        direction: m.sender_type === "client" ? "in" : "out",
        content: m.content,
        sentBy: m.sender_type === "bot" ? "bot" : "human",
        timestamp: m.created_at,
      }))
    );
  })
);

apiRouter.post(
  "/public/conversations/:id/messages",
  route(async (req, res) => {
    const content = String(req.body?.content ?? "").trim();
    if (!content) {
      res.status(400).json({ error: "content is required" });
      return;
    }
    const admin = getSupabaseAdmin();
    const { data: channel, error: channelError } = await admin
      .from("chat_channels")
      .select("id, business_id, disappearing_duration")
      .eq("id", req.params.id)
      .maybeSingle();
    if (channelError) throw channelError;
    if (!channel) {
      res.status(404).json({ error: "Conversación no encontrada" });
      return;
    }

    const { data, error } = await admin
      .from("chat_messages")
      .insert({
        channel_id: channel.id,
        business_id: channel.business_id,
        sender_type: "client",
        content,
        expires_at: computeExpiresAt(channel.disappearing_duration),
      })
      .select("id, sender_type, content, created_at, attachment_kind, attachment_id, attachment_name, attachment_mime")
      .single();
    if (error) throw error;
    res.status(201).json({
      id: data.id,
      direction: "in",
      content: data.content,
      sentBy: "human",
      timestamp: data.created_at,
    });
  })
);

// "Agendar cita" bubble: writes the same pending appointment_requests row
// the admin-side panel already manages, plus a short summary message so
// it shows up inline in the transcript.
apiRouter.post(
  "/public/conversations/:id/appointment-requests",
  route(async (req, res) => {
    const requestedDatetimeText = String(req.body?.requestedDatetimeText ?? "").trim();
    const reasonText = req.body?.reasonText ? String(req.body.reasonText).trim() : null;
    if (!requestedDatetimeText) {
      res.status(400).json({ error: "requestedDatetimeText is required" });
      return;
    }
    const admin = getSupabaseAdmin();
    const { data: channel, error: channelError } = await admin
      .from("chat_channels")
      .select("id, business_id, participant_id, disappearing_duration, flow_state")
      .eq("id", req.params.id)
      .maybeSingle();
    if (channelError) throw channelError;
    if (!channel) {
      res.status(404).json({ error: "Conversación no encontrada" });
      return;
    }

    const { data: appointment, error: appointmentError } = await admin
      .from("appointment_requests")
      .insert({
        business_id: channel.business_id,
        client_id: channel.participant_id,
        requested_datetime_text: requestedDatetimeText,
        reason_text: reasonText,
      })
      .select("id")
      .single();
    if (appointmentError) throw appointmentError;

    await admin.from("chat_messages").insert({
      channel_id: channel.id,
      business_id: channel.business_id,
      sender_type: "client",
      content: flowCopy((channel.flow_state as any)?.lang).appointmentSummary(requestedDatetimeText, reasonText),
      expires_at: computeExpiresAt(channel.disappearing_duration),
    });

    res.status(201).json({ id: appointment.id });
  })
);

// The customer's half of a change order. A contractor writing "approved" on
// their own screen is a note; the customer pressing approve is the agreement,
// which is the whole reason change orders exist.
apiRouter.get(
  "/client-portal/change-orders",
  requireClientAuth,
  route(async (req, res) => {
    const admin = getSupabaseAdmin();
    const { data: projects } = await admin.from("projects").select("id").eq("client_id", req.clientId!);
    const projectIds = (projects ?? []).map((p) => p.id);
    if (projectIds.length === 0) {
      res.json([]);
      return;
    }
    const { data, error } = await admin
      .from("change_orders")
      .select("id, title, description, amount, status, created_at, projects(name)")
      .in("project_id", projectIds)
      // A draft is the contractor still writing; only what was actually sent
      // is any of the customer's business.
      .neq("status", "borrador")
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json(
      data.map((c: any) => ({
        id: c.id,
        projectName: c.projects?.name ?? null,
        title: c.title,
        description: c.description,
        amount: Number(c.amount),
        status: c.status,
        createdAt: c.created_at,
      }))
    );
  })
);

apiRouter.post(
  "/client-portal/change-orders/:id/decide",
  requireClientAuth,
  route(async (req, res) => {
    const decision = req.body?.decision;
    if (decision !== "aprobado" && decision !== "rechazado") {
      res.status(400).json({ error: "decision must be aprobado or rechazado" });
      return;
    }
    const admin = getSupabaseAdmin();
    const { data: projects } = await admin.from("projects").select("id").eq("client_id", req.clientId!);
    const projectIds = (projects ?? []).map((p) => p.id);
    const { data: changeOrder } = await admin
      .from("change_orders")
      .select("id, status, project_id")
      .eq("id", req.params.id)
      .maybeSingle();
    if (!changeOrder || !changeOrder.project_id || !projectIds.includes(changeOrder.project_id)) {
      res.status(404).json({ error: "change order not found" });
      return;
    }
    if (changeOrder.status !== "enviado") {
      res.status(409).json({ error: "change order is not awaiting a decision" });
      return;
    }
    const { error } = await admin
      .from("change_orders")
      .update({ status: decision, decided_at: new Date().toISOString() })
      .eq("id", changeOrder.id);
    if (error) throw error;
    res.json({ ok: true, status: decision });
  })
);

// The customer's and the worker's side of attachments. Both go above the
// business gate, and both prove the channel is theirs before resolving
// anything — a message id is guessable, a permission is not.
apiRouter.get(
  "/client/chat/messages/:id/attachment",
  requireClientAuth,
  route(async (req, res) => {
    const admin = getSupabaseAdmin();
    const result = await resolveAttachment(admin, req.params.id, async (m) => {
      const { data: owned } = await admin
        .from("chat_channels")
        .select("id")
        .eq("id", m.channel_id)
        .eq("participant_type", "client")
        .eq("participant_id", req.clientId!)
        .maybeSingle();
      return Boolean(owned);
    });
    res.status(result.status).json(result.body);
  })
);

apiRouter.post(
  "/client/chat/channels/:id/attachments",
  requireClientAuth,
  upload.single("file"),
  route(async (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "file is required" });
      return;
    }
    const admin = getSupabaseAdmin();
    const { data: channel } = await admin
      .from("chat_channels")
      .select("id, business_id, disappearing_duration")
      .eq("id", req.params.id)
      .eq("participant_type", "client")
      .eq("participant_id", req.clientId!)
      .maybeSingle();
    if (!channel) {
      res.status(404).json({ error: "channel not found" });
      return;
    }

    const storagePath = `${channel.business_id}/${channel.id}/${randomUUID()}-${file.originalname}`;
    const { error: uploadError } = await admin.storage
      .from("chat-attachments")
      .upload(storagePath, file.buffer, { contentType: file.mimetype });
    if (uploadError) throw uploadError;

    const { data, error } = await admin
      .from("chat_messages")
      .insert({
        channel_id: channel.id,
        business_id: channel.business_id,
        sender_type: "client",
        sender_id: req.clientId!,
        content: String(req.body?.content ?? "").trim() || file.originalname,
        attachment_kind: file.mimetype.startsWith("image/") ? "image" : "file",
        attachment_path: storagePath,
        attachment_name: file.originalname,
        attachment_mime: file.mimetype,
        expires_at: computeExpiresAt(channel.disappearing_duration),
      })
      .select("id, sender_type, content, created_at, attachment_kind, attachment_id, attachment_name, attachment_mime")
      .single();
    if (error) throw error;

    res.status(201).json({
      id: data.id,
      senderType: data.sender_type,
      content: data.content,
      timestamp: data.created_at,
      attachment: { kind: data.attachment_kind, id: data.attachment_id, name: data.attachment_name, mime: data.attachment_mime },
    });
  })
);

apiRouter.get(
  "/worker/chat/messages/:id/attachment",
  requireWorkerAuth,
  route(async (req, res) => {
    const admin = getSupabaseAdmin();
    const result = await resolveAttachment(admin, req.params.id, async (m) => {
      const { data: owned } = await admin
        .from("chat_channels")
        .select("id")
        .eq("id", m.channel_id)
        .eq("participant_type", req.workerKind!)
        .eq("participant_id", req.workerId!)
        .maybeSingle();
      return Boolean(owned);
    });
    res.status(result.status).json(result.body);
  })
);

// The crew's half of the same conversation. A worker standing in front of a
// problem — a wall that is not where the plan says, a part that arrived wrong
// — needs to send the photo, not describe it. Mirrors the client route above;
// the only differences are which participant column proves the channel is
// theirs and which sender_type the message carries.
apiRouter.post(
  "/worker/chat/channels/:id/attachments",
  requireWorkerAuth,
  upload.single("file"),
  route(async (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "file is required" });
      return;
    }
    const admin = getSupabaseAdmin();
    const { data: channel } = await admin
      .from("chat_channels")
      .select("id, business_id, status, disappearing_duration")
      .eq("id", req.params.id)
      .eq("business_id", req.workerBusinessId!)
      .eq("participant_type", req.workerKind!)
      .eq("participant_id", req.workerId!)
      .maybeSingle();
    if (!channel) {
      res.status(404).json({ error: "channel not found" });
      return;
    }
    // Same gate the text messages use: an invitation that has not been
    // accepted is not yet a conversation.
    if (channel.status !== "activo") {
      res.status(403).json({ error: "Acepta la invitación antes de escribir" });
      return;
    }

    const storagePath = `${channel.business_id}/${channel.id}/${randomUUID()}-${file.originalname}`;
    const { error: uploadError } = await admin.storage
      .from("chat-attachments")
      .upload(storagePath, file.buffer, { contentType: file.mimetype });
    if (uploadError) throw uploadError;

    const { data, error } = await admin
      .from("chat_messages")
      .insert({
        channel_id: channel.id,
        business_id: channel.business_id,
        sender_type: req.workerKind!,
        sender_id: req.workerId!,
        content: String(req.body?.content ?? "").trim() || file.originalname,
        attachment_kind: file.mimetype.startsWith("image/") ? "image" : "file",
        attachment_path: storagePath,
        attachment_name: file.originalname,
        attachment_mime: file.mimetype,
        expires_at: computeExpiresAt(channel.disappearing_duration),
      })
      .select("id, sender_type, content, created_at, attachment_kind, attachment_id, attachment_name, attachment_mime")
      .single();
    if (error) throw error;

    res.status(201).json({
      id: data.id,
      senderType: data.sender_type,
      content: data.content,
      timestamp: data.created_at,
      attachment: { kind: data.attachment_kind, id: data.attachment_id, name: data.attachment_name, mime: data.attachment_mime },
    });
  })
);

// The customer accepting their own estimate — the moment a lead becomes a
// job. Only an estimate that was actually sent to them can be accepted, so a
// draft the contractor is still pricing can't be locked in behind their back.
apiRouter.post(
  "/client-portal/estimates/:id/accept",
  requireClientAuth,
  route(async (req, res) => {
    // A typed name is the signature. Not a formality: the consent sentence is
    // in front of them when they type it, which is what makes this an act
    // rather than a click, and it is the part that identifies who signed.
    const signedName = String(req.body?.signedName ?? "").trim();
    if (signedName.length < 2) {
      res.status(400).json({ error: "signedName is required", code: "signature_required" });
      return;
    }
    // A drawn mark is optional and never the proof on its own. Bounded because
    // a canvas can produce a very large data URI and this row is read often.
    const signatureImage = String(req.body?.signatureImage ?? "").slice(0, 200_000) || null;

    const admin = getSupabaseAdmin();
    const { data: estimate } = await admin
      .from("estimates")
      .select("id, status, business_id, client_id, project_id, description, total, clients(name, source)")
      .eq("id", req.params.id)
      .eq("client_id", req.clientId!)
      .maybeSingle();
    if (!estimate) {
      res.status(404).json({ error: "estimate not found" });
      return;
    }
    if (estimate.status === "aceptado") {
      res.json({ ok: true, status: "aceptado" });
      return;
    }
    if (estimate.status !== "enviado") {
      res.status(409).json({ error: "estimate is not awaiting acceptance" });
      return;
    }
    // Written first: an estimate that reads "accepted" with no signature behind
    // it is exactly the state this feature exists to remove, so the signature
    // is what the rest depends on rather than a side effect of it.
    const { error: signError } = await admin.from("estimate_signatures").insert({
      business_id: estimate.business_id,
      estimate_id: estimate.id,
      client_id: estimate.client_id,
      signed_name: signedName,
      signature_image: signatureImage,
      // The figure agreed, pinned here. Reading it back off the estimate later
      // would let an edit rewrite what somebody signed.
      signed_total: Number(estimate.total ?? 0),
      // Behind a proxy the first hop is the real client; Express gives the
      // socket address otherwise.
      ip_address: (String(req.headers["x-forwarded-for"] ?? "").split(",")[0] || req.ip || "").trim() || null,
      user_agent: String(req.headers["user-agent"] ?? "").slice(0, 500) || null,
    });
    if (signError) throw signError;

    const { error } = await admin.from("estimates").update({ status: "aceptado" }).eq("id", estimate.id);
    if (error) throw error;

    // A customer accepting in the portal is the same commercial event as the
    // contractor accepting for them in the panel, so it has to have the same
    // consequence: the job appears under Proyectos. Without this the estimate
    // went green and nothing else in the software knew about it — the crew had
    // nothing to clock into and the office had no job to schedule.
    const client = estimate.clients as unknown as { name: string | null; source: string | null } | null;
    let projectId = estimate.project_id as string | null;
    if (!projectId) {
      const { data: project, error: projectError } = await admin
        .from("projects")
        .insert({
          business_id: estimate.business_id,
          client_id: estimate.client_id,
          estimate_id: estimate.id,
          name: estimate.description?.trim() || client?.name || "Nuevo proyecto",
          status: "planificacion",
          origin: originFromClientSource(client?.source),
        })
        .select("id")
        .single();
      if (projectError) throw projectError;
      projectId = project.id;
      await admin.from("estimates").update({ project_id: projectId }).eq("id", estimate.id);
    }

    await materializePlan(admin, estimate.business_id, projectId!);
    await advanceAndBill(admin, {
      businessId: estimate.business_id,
      projectId: projectId!,
      trigger: "presupuesto_aceptado",
      actor: "cliente",
    });

    res.json({ ok: true, status: "aceptado", projectId });
  })
);

// The customer signing off the finished work. This is the difference between
// "we think we're done" and "they agree we're done", and in a trade where the
// last payment is argued about it is worth having on record with a timestamp.
// It does not close the job — the final invoice still has to be paid.
apiRouter.post(
  "/client-portal/projects/:id/confirm",
  requireClientAuth,
  route(async (req, res) => {
    const admin = getSupabaseAdmin();
    const { data: project } = await admin
      .from("projects")
      .select("id, business_id, status")
      .eq("id", req.params.id)
      .eq("client_id", req.clientId!)
      .maybeSingle();
    if (!project) {
      res.status(404).json({ error: "project not found" });
      return;
    }
    if (project.status !== "en_progreso") {
      res.status(409).json({ error: "this project is not awaiting confirmation" });
      return;
    }

    const status = await advanceAndBill(admin, {
      businessId: project.business_id,
      projectId: project.id,
      trigger: "cliente_confirmo",
      actor: "cliente",
      note: typeof req.body?.note === "string" ? req.body.note.slice(0, 500) : undefined,
    });
    res.json({ ok: true, status: status ?? project.status });
  })
);

apiRouter.get(
  "/client-portal/estimates/:id/pdf",
  requireClientAuth,
  route(async (req, res) => {
    // The customer is the other half of these documents, so they get the
    // same file the contractor does — but only for an estimate that is
    // actually theirs, checked here rather than left to RLS because a client
    // who entered with an access code has no auth.uid() to check against.
    const admin = getSupabaseAdmin();
    const { data: owned } = await admin
      .from("estimates")
      .select("id, business_id")
      .eq("id", req.params.id)
      .eq("client_id", req.clientId!)
      .maybeSingle();
    if (!owned) {
      res.status(404).json({ error: "estimate not found" });
      return;
    }
    const pdf = await buildEstimatePdf(owned.business_id, owned.id, normalizeDocLang(req.query.lang));
    if (!pdf) {
      res.status(404).json({ error: "estimate not found" });
      return;
    }
    sendPdf(res, pdf, `${documentNumber("estimate", owned.id)}.pdf`, "attachment");
  })
);

apiRouter.get(
  "/client-portal/invoices/:id/pdf",
  requireClientAuth,
  route(async (req, res) => {
    const admin = getSupabaseAdmin();
    const { data: owned } = await admin
      .from("invoices")
      .select("id, business_id")
      .eq("id", req.params.id)
      .eq("client_id", req.clientId!)
      .maybeSingle();
    if (!owned) {
      res.status(404).json({ error: "invoice not found" });
      return;
    }
    const pdf = await buildInvoicePdf(owned.business_id, owned.id, normalizeDocLang(req.query.lang));
    if (!pdf) {
      res.status(404).json({ error: "invoice not found" });
      return;
    }
    sendPdf(res, pdf, `${documentNumber("invoice", owned.id)}.pdf`, "attachment");
  })
);

// Everything below this line is the business panel — every route resolves
// its business_id from the caller's own Supabase Auth session (never a
// hardcoded constant), and every query below runs through req.supabase,
// a client carrying that same session, so Postgres RLS is what actually
// enforces one business never sees another's rows.
apiRouter.use(requireBusinessAuth);

// ---------- Materials & Costs ----------
// Materials, labor rates and subcontractor trades live in three separate
// tables (per the Fase B schema) but the screen displays them as one
// combined catalog grouped by category, matching the Fase A mock UI.
apiRouter.get(
  "/materials",
  route(async (req, res) => {
    const supabase = req.supabase!;

    const [materials, laborRates, subcontractors] = await Promise.all([
      supabase
        .from("materials_catalog")
        .select("id, name, unit, price, category, supplier, is_reference_only")
        .eq("business_id", req.businessId!)
        .order("name"),
      supabase
        .from("labor_rates")
        .select("id, name, hourly_rate")
        .eq("business_id", req.businessId!)
        .order("name"),
      supabase
        .from("subcontractors")
        .select("id, name, trade, phone, rating, hourly_rate, access_token_hash")
        .eq("business_id", req.businessId!)
        .order("name"),
    ]);

    if (materials.error) throw materials.error;
    if (laborRates.error) throw laborRates.error;
    if (subcontractors.error) throw subcontractors.error;

    res.json({
      materials: materials.data.map((m) => ({
        id: m.id,
        name: m.name,
        unit: m.unit,
        price: m.price,
        category: m.category,
        supplier: m.supplier,
        isReferenceOnly: m.is_reference_only,
      })),
      laborRates: laborRates.data.map((l) => ({
        id: l.id,
        name: l.name,
        hourlyRate: l.hourly_rate,
      })),
      subcontractors: subcontractors.data.map((s) => ({
        id: s.id,
        name: s.name,
        trade: s.trade,
        phone: s.phone,
        rating: s.rating,
        hourlyRate: s.hourly_rate === null ? null : Number(s.hourly_rate),
        // Whether they can actually open the field app — the only "linked or
        // not" state this product really has for a subcontractor.
        hasAccessCode: Boolean(s.access_token_hash),
      })),
    });
  })
);

// ---------- Budgets & Estimates ----------

apiRouter.get(
  "/estimates",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("estimates")
      .select(
        "id, client_id, project_id, status, created_by, category_id, description, total, created_at, clients(name), budget_categories(name), estimate_signatures(signed_name, signed_at, signed_total)"
      )
      .eq("business_id", req.businessId!)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json(
      data.map((e: any) => ({
        id: e.id,
        clientId: e.client_id,
        clientName: e.clients?.name ?? null,
        // The most recent signature. An estimate marked accepted with none is
        // one the contractor accepted on the client's behalf, and the panel
        // should not imply otherwise.
        signature: (() => {
          const rows = (e.estimate_signatures ?? []) as { signed_name: string; signed_at: string; signed_total: number }[];
          const latest = rows.slice().sort((a, b) => b.signed_at.localeCompare(a.signed_at))[0];
          return latest
            ? { name: latest.signed_name, signedAt: latest.signed_at, total: Number(latest.signed_total) }
            : null;
        })(),
        projectId: e.project_id,
        status: e.status,
        createdBy: e.created_by,
        categoryId: e.category_id,
        categoryName: e.budget_categories?.name ?? null,
        description: e.description,
        total: Number(e.total),
        createdAt: e.created_at,
      }))
    );
  })
);

apiRouter.get(
  "/estimates/:id",
  route(async (req, res) => {
    const supabase = req.supabase!;

    const [estimate, lines] = await Promise.all([
      supabase
        .from("estimates")
        .select(
          "id, client_id, project_id, status, created_by, category_id, description, margin_type, margin_percent, waste_percent, total, created_at, clients(name, address, phone, email), budget_categories(name)"
        )
        .eq("business_id", req.businessId!)
        .eq("id", req.params.id)
        .single(),
      supabase
        .from("estimate_lines")
        .select("id, zone, category, item_name, quantity, unit_cost, total, visible_to_client")
        .eq("business_id", req.businessId!)
        .eq("estimate_id", req.params.id)
        .order("zone"),
    ]);

    if (estimate.error) throw estimate.error;
    if (lines.error) throw lines.error;

    const client = estimate.data.clients as unknown as { name: string; address: string; phone: string; email: string } | null;

    res.json({
      id: estimate.data.id,
      clientId: estimate.data.client_id,
      clientName: client?.name ?? null,
      clientAddress: client?.address ?? null,
      clientPhone: client?.phone ?? null,
      clientEmail: client?.email ?? null,
      projectId: estimate.data.project_id,
      status: estimate.data.status,
      createdBy: estimate.data.created_by,
      categoryId: estimate.data.category_id,
      categoryName: (estimate.data.budget_categories as any)?.name ?? null,
      description: estimate.data.description,
      marginType: estimate.data.margin_type,
      marginPercent: Number(estimate.data.margin_percent),
      wastePercent: Number(estimate.data.waste_percent),
      total: Number(estimate.data.total),
      createdAt: estimate.data.created_at,
      lines: lines.data.map((l) => ({
        id: l.id,
        zone: l.zone,
        category: l.category,
        item: l.item_name,
        quantity: Number(l.quantity),
        unitCost: Number(l.unit_cost),
        total: Number(l.total),
        visibleToClient: l.visible_to_client,
      })),
    });
  })
);

// Recomputes and persists estimates.total from its current lines + margin/waste,
// mirroring the client-side preview formula exactly. Called after every line
// mutation and every margin/waste save so the stored total never goes stale.
async function recalcEstimateTotal(supabase: ReturnType<typeof getSupabaseAdmin>, estimateId: string) {
  const [estimate, lines] = await Promise.all([
    supabase.from("estimates").select("margin_percent, waste_percent").eq("id", estimateId).single(),
    supabase.from("estimate_lines").select("total").eq("estimate_id", estimateId),
  ]);
  if (estimate.error) throw estimate.error;
  if (lines.error) throw lines.error;

  const subtotal = lines.data.reduce((sum, l) => sum + Number(l.total), 0);
  const wasteAmount = subtotal * (Number(estimate.data.waste_percent) / 100);
  const marginAmount = (subtotal + wasteAmount) * (Number(estimate.data.margin_percent) / 100);
  const total = subtotal + wasteAmount + marginAmount;

  const { error } = await supabase.from("estimates").update({ total }).eq("id", estimateId);
  if (error) throw error;
}

// Creates a brand-new empty estimate (not one of the seeded ones) so
// "New Budget" has something real to open the builder on.
apiRouter.post(
  "/estimates",
  route(async (req, res) => {
    const clientId = req.body?.clientId;
    if (!clientId) {
      res.status(400).json({ error: "clientId is required" });
      return;
    }

    const supabase = req.supabase!;
    const { data: settings } = await supabase
      .from("business_settings")
      .select("default_margin_type, default_waste_percent")
      .eq("business_id", req.businessId!)
      .single();

    const { data, error } = await supabase
      .from("estimates")
      .insert({
        business_id: req.businessId!,
        client_id: clientId,
        project_id: req.body?.projectId ?? null,
        category_id: req.body?.categoryId ?? null,
        margin_type: settings?.default_margin_type ?? "global",
        waste_percent: settings?.default_waste_percent ?? 0,
        margin_percent: 0,
        status: "borrador",
        created_by: "human",
      })
      .select("id")
      .single();

    if (error) throw error;
    res.json({ id: data.id });
  })
);

// Persists the margin/waste settings the admin edited locally in the
// builder (line and visibility edits already save immediately below).
apiRouter.patch(
  "/estimates/:id",
  route(async (req, res) => {
    const body = req.body ?? {};
    const update: Record<string, unknown> = {};
    if (body.marginType !== undefined) update.margin_type = body.marginType;
    if (body.marginPercent !== undefined) update.margin_percent = body.marginPercent;
    if (body.wastePercent !== undefined) update.waste_percent = body.wastePercent;

    const supabase = req.supabase!;
    if (Object.keys(update).length > 0) {
      const { error } = await supabase
        .from("estimates")
        .update(update)
        .eq("business_id", req.businessId!)
        .eq("id", req.params.id);
      if (error) throw error;
    }

    await recalcEstimateTotal(supabase, req.params.id);
    res.json({ ok: true });
  })
);

apiRouter.post(
  "/estimates/:id/lines",
  route(async (req, res) => {
    const body = req.body ?? {};
    if (!body.zone || !body.category || !body.itemName) {
      res.status(400).json({ error: "zone, category and itemName are required" });
      return;
    }

    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("estimate_lines")
      .insert({
        business_id: req.businessId!,
        estimate_id: req.params.id,
        zone: body.zone,
        category: body.category,
        item_name: body.itemName,
        quantity: body.quantity ?? 1,
        unit_cost: body.unitCost ?? 0,
        visible_to_client: body.visibleToClient ?? false,
      })
      .select("id")
      .single();

    if (error) throw error;
    await recalcEstimateTotal(supabase, req.params.id);
    res.json({ id: data.id });
  })
);

apiRouter.patch(
  "/estimates/:id/lines/:lineId",
  route(async (req, res) => {
    const body = req.body ?? {};
    const update: Record<string, unknown> = {};
    if (body.zone !== undefined) update.zone = body.zone;
    if (body.category !== undefined) update.category = body.category;
    if (body.itemName !== undefined) update.item_name = body.itemName;
    if (body.quantity !== undefined) update.quantity = body.quantity;
    if (body.unitCost !== undefined) update.unit_cost = body.unitCost;
    if (body.visibleToClient !== undefined) update.visible_to_client = body.visibleToClient;

    const supabase = req.supabase!;
    if (Object.keys(update).length > 0) {
      const { error } = await supabase
        .from("estimate_lines")
        .update(update)
        .eq("business_id", req.businessId!)
        .eq("id", req.params.lineId);
      if (error) throw error;
    }

    await recalcEstimateTotal(supabase, req.params.id);
    res.json({ ok: true });
  })
);

apiRouter.delete(
  "/estimates/:id/lines/:lineId",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { error } = await supabase
      .from("estimate_lines")
      .delete()
      .eq("business_id", req.businessId!)
      .eq("id", req.params.lineId);
    if (error) throw error;

    await recalcEstimateTotal(supabase, req.params.id);
    res.json({ ok: true });
  })
);

// Bulk-inserts an Assembly Template's items as real lines under the given
// zone. Subcontractor items have no catalog cost (schema has none), so
// unit_cost lands on 0 and the admin adjusts it inline afterward.
apiRouter.post(
  "/estimates/:id/lines/from-template",
  route(async (req, res) => {
    const { templateId, zone } = req.body ?? {};
    if (!templateId || !zone) {
      res.status(400).json({ error: "templateId and zone are required" });
      return;
    }

    const supabase = req.supabase!;
    const { data: items, error: itemsError } = await supabase
      .from("assembly_items")
      .select(
        "quantity_default, materials_catalog(name, price), labor_rates(name, hourly_rate), subcontractors(name)"
      )
      .eq("business_id", req.businessId!)
      .eq("assembly_template_id", templateId);

    if (itemsError) throw itemsError;
    if (items.length === 0) {
      res.json({ inserted: 0 });
      return;
    }

    const rows = items.map((i: any) => {
      if (i.materials_catalog) {
        return {
          business_id: req.businessId!,
          estimate_id: req.params.id,
          zone,
          category: "Materiales",
          item_name: i.materials_catalog.name,
          quantity: Number(i.quantity_default),
          unit_cost: Number(i.materials_catalog.price ?? 0),
        };
      }
      if (i.labor_rates) {
        return {
          business_id: req.businessId!,
          estimate_id: req.params.id,
          zone,
          category: "Mano de obra",
          item_name: i.labor_rates.name,
          quantity: Number(i.quantity_default),
          unit_cost: Number(i.labor_rates.hourly_rate ?? 0),
        };
      }
      return {
        business_id: req.businessId!,
        estimate_id: req.params.id,
        zone,
        category: "Subcontratistas",
        item_name: i.subcontractors?.name ?? "Subcontratista",
        quantity: Number(i.quantity_default),
        unit_cost: 0,
      };
    });

    const { error: insertError } = await supabase.from("estimate_lines").insert(rows);
    if (insertError) throw insertError;

    await recalcEstimateTotal(supabase, req.params.id);
    res.json({ inserted: rows.length });
  })
);

// Admin approves (or rejects) a bot-drafted estimate before it reaches
// the client — moves 'pendiente_aprobacion' -> 'enviado' (or 'rechazado').
// Kept generic (not restricted to that one transition) since the admin
// can also manually move a draft forward without ever involving the bot.
apiRouter.patch(
  "/estimates/:id/status",
  route(async (req, res) => {
    const allowed = ["borrador", "pendiente_aprobacion", "enviado", "aceptado", "rechazado"];
    const status = req.body?.status;
    if (!allowed.includes(status)) {
      res.status(400).json({ error: `status must be one of: ${allowed.join(", ")}` });
      return;
    }

    const supabase = req.supabase!;
    const { data: estimate, error } = await supabase
      .from("estimates")
      .update({ status })
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id)
      .select("client_id")
      .single();

    if (error) throw error;

    if (status === "enviado" && estimate.client_id) {
      // Never let account provisioning fail the estimate update itself.
      try {
        await ensureClientAccount(req.businessId!, estimate.client_id);
      } catch (err) {
        console.error("ensureClientAccount failed", err);
      }
    }

    res.json({ ok: true });
  })
);

// Tags an estimate with a business-defined category (cocina, reforma...) so
// the future estimate-drafting AI can study same-category history for
// margins/structure. Every manually-created estimate should set this on save.
apiRouter.patch(
  "/estimates/:id/category",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { error } = await supabase
      .from("estimates")
      .update({ category_id: req.body?.categoryId ?? null })
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);

    if (error) throw error;
    res.json({ ok: true });
  })
);

// ---------- Estimate work projection ----------
// Staged plan ("who works when, for how long") for an estimate that
// isn't a real project yet. Accepting the estimate (below) turns every
// pending item into a real schedule_events row.

apiRouter.get(
  "/estimates/:id/projection",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("estimate_projection_items")
      .select(
        "id, title, zone, planned_start, duration_minutes, notes, status, employees:assigned_employee_id(id, name), subcontractors:assigned_subcontractor_id(id, name)"
      )
      .eq("business_id", req.businessId!)
      .eq("estimate_id", req.params.id)
      .order("planned_start");

    if (error) throw error;

    res.json(
      data.map((i: any) => ({
        id: i.id,
        title: i.title,
        zone: i.zone,
        plannedStart: i.planned_start,
        durationMinutes: i.duration_minutes,
        notes: i.notes,
        status: i.status,
        assignedWorkerId: i.employees?.id ?? i.subcontractors?.id ?? null,
        assignedWorkerName: i.employees?.name ?? i.subcontractors?.name ?? null,
      }))
    );
  })
);

apiRouter.post(
  "/estimates/:id/projection",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const body = req.body ?? {};

    if (!body.title || !body.plannedStart) {
      res.status(400).json({ error: "title and plannedStart are required" });
      return;
    }
    if (body.assignedEmployeeId && body.assignedSubcontractorId) {
      res.status(400).json({ error: "Assign to only one worker, not both" });
      return;
    }

    const { data, error } = await supabase
      .from("estimate_projection_items")
      .insert({
        business_id: req.businessId!,
        estimate_id: req.params.id,
        title: body.title,
        zone: body.zone ?? null,
        planned_start: body.plannedStart,
        duration_minutes: body.durationMinutes ?? 60,
        notes: body.notes ?? null,
        assigned_employee_id: body.assignedEmployeeId ?? null,
        assigned_subcontractor_id: body.assignedSubcontractorId ?? null,
      })
      .select("id")
      .single();

    if (error) throw error;
    res.status(201).json({ id: data.id });
  })
);

apiRouter.delete(
  "/estimates/:id/projection/:itemId",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { error } = await supabase
      .from("estimate_projection_items")
      .delete()
      .eq("business_id", req.businessId!)
      .eq("estimate_id", req.params.id)
      .eq("id", req.params.itemId);

    if (error) throw error;
    res.json({ ok: true });
  })
);

// Accept an estimate: creates its project (if it doesn't have one yet)
// and materializes every pending projection item into a real,
// worker-anchored schedule_events row — this is the automatic
// "presupuesto aceptado -> calendario poblado" step the future AI
// integration (and the admin, manually, today) relies on.
apiRouter.post(
  "/estimates/:id/accept",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const estimateId = req.params.id;

    const { data: estimate, error: estimateError } = await supabase
      .from("estimates")
      .select("id, client_id, project_id, status, clients(source)")
      .eq("business_id", req.businessId!)
      .eq("id", estimateId)
      .single();
    if (estimateError) throw estimateError;

    let projectId = estimate.project_id as string | null;
    if (!projectId) {
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert({
          business_id: req.businessId!,
          client_id: estimate.client_id,
          estimate_id: estimateId,
          name: req.body?.projectName || "Nuevo proyecto",
          type: req.body?.projectType ?? null,
          status: "planificacion",
          origin: originFromClientSource((estimate.clients as unknown as { source: string | null } | null)?.source),
        })
        .select("id")
        .single();
      if (projectError) throw projectError;
      projectId = project.id;

      const { error: linkError } = await supabase
        .from("estimates")
        .update({ project_id: projectId })
        .eq("id", estimateId);
      if (linkError) throw linkError;
    }

    const { error: statusError } = await supabase
      .from("estimates")
      .update({ status: "aceptado" })
      .eq("id", estimateId);
    if (statusError) throw statusError;

    const { data: pendingItems, error: itemsError } = await supabase
      .from("estimate_projection_items")
      .select("id, title, zone, assigned_employee_id, assigned_subcontractor_id, planned_start, duration_minutes, notes")
      .eq("business_id", req.businessId!)
      .eq("estimate_id", estimateId)
      .eq("status", "pendiente");
    if (itemsError) throw itemsError;

    for (const item of pendingItems) {
      const start = new Date(item.planned_start);
      const end = new Date(start.getTime() + item.duration_minutes * 60000);
      const { error: insertError } = await supabase.from("schedule_events").insert({
        business_id: req.businessId!,
        project_id: projectId,
        estimate_id: estimateId,
        title: item.zone ? `${item.title} (${item.zone})` : item.title,
        type: "inicio",
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        notes: item.notes,
        assigned_employee_id: item.assigned_employee_id,
        assigned_subcontractor_id: item.assigned_subcontractor_id,
        source: "proyeccion",
      });
      if (insertError) throw insertError;
    }

    if (pendingItems.length > 0) {
      const { error: markAppliedError } = await supabase
        .from("estimate_projection_items")
        .update({ status: "aplicado" })
        .eq("estimate_id", estimateId)
        .eq("status", "pendiente");
      if (markAppliedError) throw markAppliedError;

      // Everyone the projection scheduled becomes part of the project's team.
      // Without this the project has work booked for people who do not appear
      // on it, and the Technicians screen shows nobody assigned to a job that
      // is already on their calendar.
      const teamRows = Array.from(
        new Map(
          pendingItems
            .filter((item) => item.assigned_employee_id || item.assigned_subcontractor_id)
            .map((item) => [
              `${item.assigned_employee_id ?? ""}:${item.assigned_subcontractor_id ?? ""}`,
              {
                business_id: req.businessId!,
                project_id: projectId,
                employee_id: item.assigned_employee_id,
                subcontractor_id: item.assigned_subcontractor_id,
              },
            ])
        ).values()
      );

      for (const row of teamRows) {
        const { data: already } = await supabase
          .from("assignments")
          .select("id")
          .eq("business_id", req.businessId!)
          .eq("project_id", projectId)
          .eq(row.employee_id ? "employee_id" : "subcontractor_id", row.employee_id ?? row.subcontractor_id)
          .maybeSingle();
        if (already) continue;
        const { error: assignError } = await supabase.from("assignments").insert(row);
        if (assignError) throw assignError;
      }
    }

    // The acceptance is what turns a quote into a job, so the project starts
    // its lifecycle here rather than waiting for someone to remember to set it.
    // The payment schedule is copied first: advancing bills whatever the move
    // makes due, and there is nothing to bill until the stages exist.
    const admin = getSupabaseAdmin();
    await materializePlan(admin, req.businessId!, projectId!);
    await advanceAndBill(admin, {
      businessId: req.businessId!,
      projectId: projectId!,
      trigger: "presupuesto_aceptado",
      actor: "admin",
    });
    if (pendingItems.length > 0) {
      await advanceAndBill(admin, {
        businessId: req.businessId!,
        projectId: projectId!,
        trigger: "trabajo_programado",
        actor: "admin",
        note: `${pendingItems.length}`,
      });
    }

    res.json({ projectId, scheduledCount: pendingItems.length });
  })
);

// ---------- Budget categories & reference documents ----------
// Admin-defined categories (cocina, reforma, construcción...) used to tag
// estimates, plus up to MAX_REFERENCE_DOCS_PER_CATEGORY old approved-budget
// files per category the admin can upload as grounding material for
// categories with no real in-system history yet. No AI reads these yet —
// this only stores real data + real files so Fase D has something to study.

apiRouter.get(
  "/budget-categories",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("budget_categories")
      .select("id, name, created_at")
      .eq("business_id", req.businessId!)
      .order("name");

    if (error) throw error;
    res.json(data.map((c) => ({ id: c.id, name: c.name, createdAt: c.created_at })));
  })
);

apiRouter.post(
  "/budget-categories",
  route(async (req, res) => {
    const name = (req.body?.name ?? "").trim();
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("budget_categories")
      .insert({ business_id: req.businessId!, name })
      .select("id, name, created_at")
      .single();

    if (error) throw error;
    res.json({ id: data.id, name: data.name, createdAt: data.created_at });
  })
);

apiRouter.delete(
  "/budget-categories/:id",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { error } = await supabase
      .from("budget_categories")
      .delete()
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);

    if (error) throw error;
    res.json({ ok: true });
  })
);

apiRouter.get(
  "/estimate-reference-documents",
  route(async (req, res) => {
    const supabase = req.supabase!;
    let query = supabase
      .from("estimate_reference_documents")
      .select("id, category_id, file_name, storage_path, file_size, uploaded_at, budget_categories(name)")
      .eq("business_id", req.businessId!)
      .order("uploaded_at", { ascending: false });

    if (req.query.categoryId) {
      query = query.eq("category_id", req.query.categoryId as string);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json(
      data.map((d: any) => ({
        id: d.id,
        categoryId: d.category_id,
        categoryName: d.budget_categories?.name ?? null,
        fileName: d.file_name,
        fileSize: d.file_size,
        uploadedAt: d.uploaded_at,
      }))
    );
  })
);

apiRouter.post(
  "/estimate-reference-documents",
  upload.single("file"),
  route(async (req, res) => {
    const categoryId = req.body?.categoryId;
    const file = req.file;
    if (!categoryId || !file) {
      res.status(400).json({ error: "categoryId and file are required" });
      return;
    }

    const supabase = req.supabase!;

    const { count, error: countError } = await supabase
      .from("estimate_reference_documents")
      .select("id", { count: "exact", head: true })
      .eq("business_id", req.businessId!)
      .eq("category_id", categoryId);

    if (countError) throw countError;
    if ((count ?? 0) >= MAX_REFERENCE_DOCS_PER_CATEGORY) {
      res.status(400).json({
        error: `Esta categoría ya tiene ${MAX_REFERENCE_DOCS_PER_CATEGORY} presupuestos de referencia. Elimina uno antes de subir otro.`,
      });
      return;
    }

    const storagePath = `${req.businessId}/${categoryId}/${randomUUID()}-${file.originalname}`;
    const { error: uploadError } = await supabase.storage
      .from("estimate-references")
      .upload(storagePath, file.buffer, { contentType: file.mimetype });

    if (uploadError) throw uploadError;

    const { data, error } = await supabase
      .from("estimate_reference_documents")
      .insert({
        business_id: req.businessId!,
        category_id: categoryId,
        file_name: file.originalname,
        storage_path: storagePath,
        file_size: file.size,
      })
      .select("id")
      .single();

    if (error) throw error;
    res.json({ id: data.id });
  })
);

apiRouter.delete(
  "/estimate-reference-documents/:id",
  route(async (req, res) => {
    const supabase = req.supabase!;

    const { data: doc, error: fetchError } = await supabase
      .from("estimate_reference_documents")
      .select("storage_path")
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id)
      .single();

    if (fetchError) throw fetchError;

    const { error: deleteError } = await supabase
      .from("estimate_reference_documents")
      .delete()
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);

    if (deleteError) throw deleteError;

    if (doc?.storage_path) {
      await supabase.storage.from("estimate-references").remove([doc.storage_path]);
    }

    res.json({ ok: true });
  })
);

// ---------- Admin AI assistant (internal chat, separate from the
// client-facing WhatsApp bot) ----------
// No model is called here yet — this only stores the thread so the UI
// and data flow are ready the moment Fase D wires in the real Claude
// API call. The canned reply below is a clearly-labeled placeholder.

apiRouter.get(
  "/admin-assistant/messages",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("admin_assistant_messages")
      .select("id, role, content, actions_taken, created_at")
      .eq("business_id", req.businessId!)
      .order("created_at");

    if (error) throw error;

    res.json(
      data.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        actionsTaken: m.actions_taken,
        createdAt: m.created_at,
      }))
    );
  })
);

apiRouter.post(
  "/admin-assistant/messages",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const content = req.body?.content?.trim();
    if (!content) {
      res.status(400).json({ error: "content is required" });
      return;
    }

    const { error: insertUserError } = await supabase.from("admin_assistant_messages").insert({
      business_id: req.businessId!,
      role: "admin",
      content,
    });
    if (insertUserError) throw insertUserError;

    const { data: reply, error: replyError } = await supabase
      .from("admin_assistant_messages")
      .insert({
        business_id: req.businessId!,
        role: "assistant",
        content:
          "Todavía no estoy conectada a un modelo de IA real (eso es Fase D — hace falta configurar la Claude API key). " +
          "Por ahora solo guardo esta conversación para que, en cuanto se conecte, pueda leer todo el historial y actuar " +
          "sobre presupuestos, proyecciones y el calendario de cada proyecto.",
      })
      .select("id, role, content, actions_taken, created_at")
      .single();
    if (replyError) throw replyError;

    res.status(201).json({
      id: reply.id,
      role: reply.role,
      content: reply.content,
      actionsTaken: reply.actions_taken,
      createdAt: reply.created_at,
    });
  })
);

// ---------- Assembly Templates ----------
// itemCount / laborHours are derived here (not stored) so the templates
// list always reflects the current composition of each recipe.
apiRouter.get(
  "/assembly-templates",
  route(async (req, res) => {
    const supabase = req.supabase!;

    const [templates, items] = await Promise.all([
      supabase
        .from("assembly_templates")
        .select("id, name, description")
        .eq("business_id", req.businessId!)
        .order("name"),
      supabase
        .from("assembly_items")
        .select("assembly_template_id, labor_rate_id, quantity_default")
        .eq("business_id", req.businessId!),
    ]);

    if (templates.error) throw templates.error;
    if (items.error) throw items.error;

    res.json(
      templates.data.map((t) => {
        const templateItems = items.data.filter((i) => i.assembly_template_id === t.id);
        const laborHours = templateItems
          .filter((i) => i.labor_rate_id)
          .reduce((sum, i) => sum + Number(i.quantity_default), 0);
        return {
          id: t.id,
          name: t.name,
          description: t.description,
          itemCount: templateItems.length,
          laborHours,
        };
      })
    );
  })
);

// A template is only useful if the contractor can build their own: the
// seeded recipes describe somebody else's way of working. Items are replaced
// wholesale on save rather than diffed, because a recipe is edited as one
// object in the UI and a partial update would leave orphans behind.
apiRouter.get(
  "/assembly-templates/:id",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const [template, items] = await Promise.all([
      supabase
        .from("assembly_templates")
        .select("id, name, description")
        .eq("business_id", req.businessId!)
        .eq("id", req.params.id)
        .maybeSingle(),
      supabase
        .from("assembly_items")
        .select("id, material_id, labor_rate_id, subcontractor_id, quantity_default")
        .eq("business_id", req.businessId!)
        .eq("assembly_template_id", req.params.id),
    ]);
    if (template.error) throw template.error;
    if (items.error) throw items.error;
    if (!template.data) {
      res.status(404).json({ error: "template not found" });
      return;
    }
    res.json({
      id: template.data.id,
      name: template.data.name,
      description: template.data.description,
      items: items.data.map((i) => ({
        id: i.id,
        materialId: i.material_id,
        laborRateId: i.labor_rate_id,
        subcontractorId: i.subcontractor_id,
        quantity: Number(i.quantity_default),
      })),
    });
  })
);

// Each item points at exactly one catalog row — a material, a labor rate or a
// subcontractor — so the estimate builder knows which price to pull.
function normalizeAssemblyItems(raw: unknown): { materialId: string | null; laborRateId: string | null; subcontractorId: string | null; quantity: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: any) => ({
      materialId: item?.materialId || null,
      laborRateId: item?.laborRateId || null,
      subcontractorId: item?.subcontractorId || null,
      quantity: Number(item?.quantity ?? 0),
    }))
    .filter((item) => {
      const refs = [item.materialId, item.laborRateId, item.subcontractorId].filter(Boolean).length;
      return refs === 1 && item.quantity > 0;
    });
}

apiRouter.post(
  "/assembly-templates",
  route(async (req, res) => {
    const { name, description, items } = req.body ?? {};
    if (!name?.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("assembly_templates")
      .insert({ business_id: req.businessId!, name: name.trim(), description: description?.trim() || null })
      .select("id")
      .single();
    if (error) throw error;

    const rows = normalizeAssemblyItems(items).map((i) => ({
      business_id: req.businessId!,
      assembly_template_id: data.id,
      material_id: i.materialId,
      labor_rate_id: i.laborRateId,
      subcontractor_id: i.subcontractorId,
      quantity_default: i.quantity,
    }));
    if (rows.length > 0) {
      const { error: itemsError } = await supabase.from("assembly_items").insert(rows);
      if (itemsError) throw itemsError;
    }

    res.status(201).json({ id: data.id });
  })
);

apiRouter.patch(
  "/assembly-templates/:id",
  route(async (req, res) => {
    const body = req.body ?? {};
    const supabase = req.supabase!;

    const update: Record<string, unknown> = {};
    if (body.name !== undefined) update.name = String(body.name).trim();
    if (body.description !== undefined) update.description = body.description || null;
    if (Object.keys(update).length > 0) {
      const { error } = await supabase
        .from("assembly_templates")
        .update(update)
        .eq("business_id", req.businessId!)
        .eq("id", req.params.id);
      if (error) throw error;
    }

    if (body.items !== undefined) {
      const { error: deleteError } = await supabase
        .from("assembly_items")
        .delete()
        .eq("business_id", req.businessId!)
        .eq("assembly_template_id", req.params.id);
      if (deleteError) throw deleteError;

      const rows = normalizeAssemblyItems(body.items).map((i) => ({
        business_id: req.businessId!,
        assembly_template_id: req.params.id,
        material_id: i.materialId,
        labor_rate_id: i.laborRateId,
        subcontractor_id: i.subcontractorId,
        quantity_default: i.quantity,
      }));
      if (rows.length > 0) {
        const { error: insertError } = await supabase.from("assembly_items").insert(rows);
        if (insertError) throw insertError;
      }
    }

    res.json({ ok: true });
  })
);

apiRouter.delete(
  "/assembly-templates/:id",
  route(async (req, res) => {
    const supabase = req.supabase!;
    // Items first: the FK would block the parent delete otherwise.
    const { error: itemsError } = await supabase
      .from("assembly_items")
      .delete()
      .eq("business_id", req.businessId!)
      .eq("assembly_template_id", req.params.id);
    if (itemsError) throw itemsError;
    const { error } = await supabase
      .from("assembly_templates")
      .delete()
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  })
);

// ---------- CRM ----------

apiRouter.get(
  "/clients",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, phone, email, address, lead_status, source, created_at")
      .eq("business_id", req.businessId!)
      .order("name");

    if (error) throw error;

    // "Last activity" isn't stored on `clients` itself — derive it from the
    // most recent activities row per client (falls back to created_at).
    const { data: activities, error: activitiesError } = await supabase
      .from("activities")
      .select("client_id, created_at")
      .eq("business_id", req.businessId!)
      .order("created_at", { ascending: false });
    if (activitiesError) throw activitiesError;

    const lastActivityByClient = new Map<string, string>();
    for (const a of activities) {
      if (!lastActivityByClient.has(a.client_id)) {
        lastActivityByClient.set(a.client_id, a.created_at);
      }
    }

    res.json(
      data.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        leadStatus: c.lead_status,
        source: c.source,
        createdAt: c.created_at,
        lastActivity: lastActivityByClient.get(c.id) ?? c.created_at,
      }))
    );
  })
);

apiRouter.get(
  "/clients/:id",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const clientId = req.params.id;

    const [client, activities, estimates, projects] = await Promise.all([
      supabase
        .from("clients")
        .select("id, name, phone, email, address, lead_status, source, created_at")
        .eq("business_id", req.businessId!)
        .eq("id", clientId)
        .single(),
      supabase
        .from("activities")
        .select("id, type, content, created_by, created_at")
        .eq("business_id", req.businessId!)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false }),
      supabase
        .from("estimates")
        .select("id, status, total, created_at")
        .eq("business_id", req.businessId!)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false }),
      supabase
        .from("projects")
        .select("id, name")
        .eq("business_id", req.businessId!)
        .eq("client_id", clientId)
        .order("name"),
    ]);

    if (client.error) throw client.error;
    if (activities.error) throw activities.error;
    if (estimates.error) throw estimates.error;
    if (projects.error) throw projects.error;

    res.json({
      id: client.data.id,
      name: client.data.name,
      phone: client.data.phone,
      email: client.data.email,
      address: client.data.address,
      leadStatus: client.data.lead_status,
      source: client.data.source,
      createdAt: client.data.created_at,
      activities: activities.data.map((a) => ({
        id: a.id,
        type: a.type,
        content: a.content,
        createdBy: a.created_by,
        createdAt: a.created_at,
      })),
      estimates: estimates.data.map((e) => ({
        id: e.id,
        status: e.status,
        total: Number(e.total),
        createdAt: e.created_at,
      })),
      projects: projects.data,
    });
  })
);

// "Nuevo contacto" in the CRM — a lead added by hand, as opposed to one
// that arrived through the public chat flow.
apiRouter.post(
  "/clients",
  route(async (req, res) => {
    const { name, phone, email, address } = req.body ?? {};
    if (!name?.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("clients")
      .insert({
        business_id: req.businessId!,
        name: name.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        lead_status: "nuevo",
        source: "manual",
      })
      .select("id")
      .single();
    if (error) throw error;
    res.status(201).json({ id: data.id });
  })
);

// Issues a fresh access code for the Client Portal — only the hash is
// stored, so the raw code is shown to the admin exactly once here, then
// handed to the client however they already talk (in person, phone, chat).
// This is what lets a client in with no email and no password.
apiRouter.post(
  "/clients/:id/access-token",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const token = randomBytes(9).toString("base64url");
    const { error } = await supabase
      .from("clients")
      .update({ access_token_hash: hashToken(token) })
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);
    if (error) throw error;
    res.json({ token });
  })
);

// ---------- Cost Tracking ----------
// Budgeted comes from estimate_lines on the project's linked estimate (if
// any); actual comes from real expenses rows. Both are grouped by category
// per project — nothing here is a stored/precomputed aggregate.
apiRouter.get(
  "/cost-tracking",
  route(async (req, res) => {
    const supabase = req.supabase!;

    const [projects, expenses, changeOrders] = await Promise.all([
      supabase
        .from("projects")
        .select("id, name, estimate_id")
        .eq("business_id", req.businessId!)
        .order("name"),
      supabase
        .from("expenses")
        .select("project_id, category, amount")
        .eq("business_id", req.businessId!),
      supabase
        .from("change_orders")
        .select("project_id, amount")
        .eq("business_id", req.businessId!)
        .eq("status", "aprobado"),
    ]);

    if (projects.error) throw projects.error;
    if (expenses.error) throw expenses.error;
    if (changeOrders.error) throw changeOrders.error;

    const approvedByProject = new Map<string, number>();
    for (const co of changeOrders.data) {
      if (!co.project_id) continue;
      approvedByProject.set(co.project_id, (approvedByProject.get(co.project_id) ?? 0) + Number(co.amount));
    }

    const estimateIds = projects.data.map((p) => p.estimate_id).filter((id): id is string => Boolean(id));
    let lines: { estimate_id: string; category: string; total: number }[] = [];
    if (estimateIds.length > 0) {
      const { data, error } = await supabase
        .from("estimate_lines")
        .select("estimate_id, category, total")
        .eq("business_id", req.businessId!)
        .in("estimate_id", estimateIds);
      if (error) throw error;
      lines = data;
    }

    // Budget lines carry display names ("Materiales") while expenses carry
    // slugs ("materiales"), so both sides are folded onto one canonical key
    // before they are compared — otherwise a recorded expense would never
    // line up with the budget it is supposed to be measured against, and
    // every project would read as perfectly on budget forever.
    const canonical = (raw: string | null): string => {
      const value = (raw ?? "").trim().toLowerCase();
      if (value.startsWith("material")) return "materiales";
      if (value.startsWith("mano") || value === "mano_obra" || value === "labor") return "mano_obra";
      if (value.startsWith("subcontrat")) return "subcontratistas";
      if (value.startsWith("equipo")) return "equipos";
      if (value.startsWith("permiso")) return "permisos";
      return "otros";
    };

    // Hours the crew actually worked, valued at each worker's rate. Until now
    // the biggest cost on most jobs was invisible here, because only typed-in
    // expenses counted and nobody types in their own payroll. Workers with no
    // rate contribute nothing, so a business that does not track pay sees the
    // same figures it always saw.
    const labourByProject = await labourCostByProject(getSupabaseAdmin(), req.businessId!);

    const result = projects.data.map((project) => {
      const budgeted = new Map<string, number>();
      for (const line of lines) {
        if (line.estimate_id !== project.estimate_id) continue;
        const key = canonical(line.category);
        budgeted.set(key, (budgeted.get(key) ?? 0) + Number(line.total));
      }

      const actual = new Map<string, number>();
      const labour = labourByProject[project.id] ?? 0;
      if (labour > 0) actual.set("mano_obra", labour);
      for (const expense of expenses.data) {
        if (expense.project_id !== project.id) continue;
        const key = canonical(expense.category);
        actual.set(key, (actual.get(key) ?? 0) + Number(expense.amount));
      }

      const rows = Array.from(new Set(Array.from(budgeted.keys()).concat(Array.from(actual.keys()))))
        .map((category) => ({
          category,
          budgeted: budgeted.get(category) ?? 0,
          actual: actual.get(category) ?? 0,
        }))
        .filter((r) => r.budgeted > 0 || r.actual > 0);

      return {
        projectId: project.id,
        projectName: project.name,
        rows,
        // Approved change orders raise the contract price, so they belong in
        // the budget the real spend is judged against.
        approvedChangeOrders: approvedByProject.get(project.id) ?? 0,
      };
    });

    res.json(result.filter((p) => p.rows.length > 0));
  })
);

// ---------- Projects ----------

apiRouter.get(
  "/projects",
  route(async (req, res) => {
    const supabase = req.supabase!;

    const [projects, expenses, assignments] = await Promise.all([
      supabase
        .from("projects")
        .select("id, client_id, estimate_id, name, type, status, progress_percent, start_date, end_date, clients(name, address)")
        .eq("business_id", req.businessId!)
        .order("name"),
      supabase.from("expenses").select("project_id, amount").eq("business_id", req.businessId!),
      supabase
        .from("assignments")
        .select("project_id, employees(name), subcontractors(name)")
        .eq("business_id", req.businessId!),
    ]);

    if (projects.error) throw projects.error;
    if (expenses.error) throw expenses.error;
    if (assignments.error) throw assignments.error;

    // budget_total isn't a stored column — it's the project's linked
    // estimate total, fetched separately since not every project has one.
    const estimateIds = projects.data.map((p) => p.estimate_id).filter((id): id is string => Boolean(id));
    let estimateTotals = new Map<string, number>();
    if (estimateIds.length > 0) {
      const { data, error } = await supabase
        .from("estimates")
        .select("id, total")
        .in("id", estimateIds);
      if (error) throw error;
      estimateTotals = new Map(data.map((e) => [e.id, Number(e.total)]));
    }

    res.json(
      projects.data.map((p: any) => ({
        id: p.id,
        clientId: p.client_id,
        clientName: p.clients?.name ?? null,
        name: p.name,
        type: p.type,
        status: p.status,
        progressPercent: Number(p.progress_percent),
        startDate: p.start_date,
        endDate: p.end_date,
        budgetTotal: p.estimate_id ? (estimateTotals.get(p.estimate_id) ?? 0) : 0,
        budgetUsed: expenses.data
          .filter((e) => e.project_id === p.id)
          .reduce((sum, e) => sum + Number(e.amount), 0),
        team: assignments.data
          .filter((a: any) => a.project_id === p.id)
          .map((a: any) => a.employees?.name ?? a.subcontractors?.name)
          .filter(Boolean),
      }))
    );
  })
);

apiRouter.get(
  "/projects/:id",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const projectId = req.params.id;

    const [project, estimateLines, expenses, documents, photos, scheduleEvents, assignments, changeOrders] = await Promise.all([
      supabase
        .from("projects")
        .select("id, client_id, estimate_id, name, type, status, progress_percent, start_date, end_date, clients(name, address)")
        .eq("business_id", req.businessId!)
        .eq("id", projectId)
        .single(),
      supabase
        .from("estimate_lines")
        .select("id, zone, category, item_name, quantity, unit_cost, total, estimates!inner(id, project_id)")
        .eq("business_id", req.businessId!)
        .eq("estimates.project_id", projectId),
      supabase
        .from("expenses")
        .select("id, category, description, amount, date")
        .eq("business_id", req.businessId!)
        .eq("project_id", projectId),
      supabase
        .from("documents")
        .select("id, name, tag, uploaded_at")
        .eq("business_id", req.businessId!)
        .eq("project_id", projectId),
      supabase
        .from("photos")
        .select("id, zone, visible_to_client, timestamp")
        .eq("business_id", req.businessId!)
        .eq("project_id", projectId),
      supabase
        .from("schedule_events")
        .select("id, title, type, start_time")
        .eq("business_id", req.businessId!)
        .eq("project_id", projectId),
      supabase
        .from("assignments")
        .select("employees(name), subcontractors(name)")
        .eq("business_id", req.businessId!)
        .eq("project_id", projectId),
      supabase
        .from("change_orders")
        .select("id, title, description, amount, status, created_at, decided_at")
        .eq("business_id", req.businessId!)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
    ]);

    if (project.error) throw project.error;
    if (estimateLines.error) throw estimateLines.error;
    if (expenses.error) throw expenses.error;
    if (documents.error) throw documents.error;
    if (photos.error) throw photos.error;
    if (scheduleEvents.error) throw scheduleEvents.error;
    if (assignments.error) throw assignments.error;
    if (changeOrders.error) throw changeOrders.error;

    const client = (project.data as any).clients as { name: string; address: string | null } | null;

    // The checklist is derived from the other tables, so it is read after
    // them rather than folded into the batch above.
    const lifecycle = await lifecycleSnapshot(getSupabaseAdmin(), req.businessId!, projectId);

    res.json({
      id: project.data.id,
      clientId: project.data.client_id,
      clientName: client?.name ?? null,
      // The project hub links out to the estimate PDF, the client's chat and
      // a map, so it needs the ids and the address to build those links.
      clientAddress: client?.address ?? null,
      estimateId: project.data.estimate_id ?? null,
      name: project.data.name,
      type: project.data.type,
      status: project.data.status,
      lifecycle,
      progressPercent: Number(project.data.progress_percent),
      startDate: project.data.start_date,
      endDate: project.data.end_date,
      team: (assignments.data as any[])
        .map((a) => a.employees?.name ?? a.subcontractors?.name)
        .filter(Boolean),
      estimateLines: estimateLines.data.map((l: any) => ({
        id: l.id,
        zone: l.zone,
        category: l.category,
        item: l.item_name,
        total: Number(l.total),
      })),
      expenses: expenses.data.map((e) => ({
        id: e.id,
        category: e.category,
        description: e.description,
        amount: Number(e.amount),
        date: e.date,
      })),
      documents: documents.data.map((d) => ({
        id: d.id,
        name: d.name,
        tag: d.tag,
        uploadedAt: d.uploaded_at,
      })),
      photos: photos.data.map((p) => ({
        id: p.id,
        zone: p.zone,
        visibleToClient: p.visible_to_client,
        timestamp: p.timestamp,
      })),
      scheduleEvents: scheduleEvents.data.map((s) => ({
        id: s.id,
        title: s.title,
        type: s.type,
        startTime: s.start_time,
      })),
      changeOrders: changeOrders.data.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        amount: Number(c.amount),
        status: c.status,
        createdAt: c.created_at,
        decidedAt: c.decided_at,
      })),
    });
  })
);

apiRouter.post(
  "/projects",
  route(async (req, res) => {
    const { clientId, name, type, startDate, endDate, estimateId } = req.body ?? {};
    if (!clientId || !name?.trim()) {
      res.status(400).json({ error: "clientId and name are required" });
      return;
    }
    const supabase = req.supabase!;
    // A job the contractor types in still inherits the door its client came
    // through: a lead who arrived by public chat and was later written up by
    // hand is still a chat lead, and the checklist has to say so.
    const { data: client } = await supabase
      .from("clients")
      .select("source")
      .eq("business_id", req.businessId!)
      .eq("id", clientId)
      .maybeSingle();

    const { data, error } = await supabase
      .from("projects")
      .insert({
        business_id: req.businessId!,
        client_id: clientId,
        estimate_id: estimateId ?? null,
        name: name.trim(),
        type: type?.trim() || null,
        status: "planificacion",
        origin: originFromClientSource(client?.source),
        progress_percent: 0,
        start_date: startDate || null,
        end_date: endDate || null,
      })
      .select("id")
      .single();
    if (error) throw error;
    res.status(201).json({ id: data.id });
  })
);

// ---------- Contracts & Documents ----------

apiRouter.get(
  "/documents",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("documents")
      .select("id, name, tag, uploaded_at, project_id, projects(name)")
      .eq("business_id", req.businessId!)
      .order("uploaded_at", { ascending: false });

    if (error) throw error;

    res.json(
      data.map((d: any) => ({
        id: d.id,
        name: d.name,
        tag: d.tag,
        uploadedAt: d.uploaded_at,
        projectId: d.project_id,
        projectName: d.projects?.name ?? null,
      }))
    );
  })
);

// Uploads a real file to the project-documents bucket and records it. The
// bucket is private; the row stores the storage path and reads go through a
// short-lived signed URL rather than a public link.
apiRouter.post(
  "/documents",
  upload.single("file"),
  route(async (req, res) => {
    const { projectId, tag, name } = req.body ?? {};
    const file = req.file;
    if (!projectId || !file) {
      res.status(400).json({ error: "projectId and file are required" });
      return;
    }
    if (tag && !["contrato", "permiso", "plano", "garantia"].includes(tag)) {
      res.status(400).json({ error: "tag must be contrato, permiso, plano or garantia" });
      return;
    }

    const supabase = req.supabase!;
    const storagePath = `${req.businessId}/${projectId}/${randomUUID()}-${file.originalname}`;
    const { error: uploadError } = await supabase.storage
      .from("project-documents")
      .upload(storagePath, file.buffer, { contentType: file.mimetype });
    if (uploadError) throw uploadError;

    const { data, error } = await supabase
      .from("documents")
      .insert({
        business_id: req.businessId!,
        project_id: projectId,
        name: (name?.trim() || file.originalname),
        file_url: storagePath,
        tag: tag || null,
      })
      .select("id")
      .single();
    if (error) throw error;
    res.status(201).json({ id: data.id });
  })
);

// Short-lived signed URL for one document — the bucket stays private, so
// this is the only way a stored file is ever readable.
apiRouter.get(
  "/documents/:id/download-url",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data: doc, error } = await supabase
      .from("documents")
      .select("file_url")
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id)
      .maybeSingle();
    if (error) throw error;
    if (!doc?.file_url) {
      res.status(404).json({ error: "Documento no encontrado" });
      return;
    }
    const { data: signed, error: signError } = await supabase.storage
      .from("project-documents")
      .createSignedUrl(doc.file_url, 300);
    if (signError) throw signError;
    res.json({ url: signed.signedUrl });
  })
);

// ---------- Photo Gallery ----------

apiRouter.get(
  "/photos",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("photos")
      .select(
        "id, zone, timestamp, visible_to_client, project_id, projects(name), employees:uploaded_by_employee_id(name), subcontractors:uploaded_by_subcontractor_id(name)"
      )
      .eq("business_id", req.businessId!)
      .order("timestamp", { ascending: false });

    if (error) throw error;

    res.json(
      data.map((p: any) => ({
        id: p.id,
        projectId: p.project_id,
        projectName: p.projects?.name ?? null,
        zone: p.zone,
        timestamp: p.timestamp,
        visibleToClient: p.visible_to_client,
        uploadedBy: p.employees?.name ?? p.subcontractors?.name ?? null,
      }))
    );
  })
);

apiRouter.post(
  "/photos",
  upload.single("file"),
  route(async (req, res) => {
    const { projectId, zone, visibleToClient } = req.body ?? {};
    const file = req.file;
    if (!projectId || !file) {
      res.status(400).json({ error: "projectId and file are required" });
      return;
    }

    const supabase = req.supabase!;
    const storagePath = `${req.businessId}/${projectId}/${randomUUID()}-${file.originalname}`;
    const { error: uploadError } = await supabase.storage
      .from("project-photos")
      .upload(storagePath, file.buffer, { contentType: file.mimetype });
    if (uploadError) throw uploadError;

    const { data, error } = await supabase
      .from("photos")
      .insert({
        business_id: req.businessId!,
        project_id: projectId,
        url: storagePath,
        zone: zone?.trim() || null,
        // Nothing is shown to the client unless the business says so.
        visible_to_client: visibleToClient === "true" || visibleToClient === true,
      })
      .select("id")
      .single();
    if (error) throw error;
    res.status(201).json({ id: data.id });
  })
);

apiRouter.get(
  "/photos/:id/url",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data: photo, error } = await supabase
      .from("photos")
      .select("url")
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id)
      .maybeSingle();
    if (error) throw error;
    if (!photo?.url) {
      res.status(404).json({ error: "Foto no encontrada" });
      return;
    }
    const { data: signed, error: signError } = await supabase.storage
      .from("project-photos")
      .createSignedUrl(photo.url, 300);
    if (signError) throw signError;
    res.json({ url: signed.signedUrl });
  })
);

// ---------- Technicians & Crew ----------

apiRouter.get(
  "/employees",
  route(async (req, res) => {
    const supabase = req.supabase!;

    const [employees, assignments, timeEntries] = await Promise.all([
      supabase
        .from("employees")
        .select("id, name, role, phone, status, hourly_rate")
        .eq("business_id", req.businessId!)
        .order("name"),
      supabase
        .from("assignments")
        .select("employee_id, projects(name)")
        .eq("business_id", req.businessId!)
        .not("employee_id", "is", null),
      supabase
        .from("time_entries")
        .select("employee_id, check_in_time, check_out_time")
        .eq("business_id", req.businessId!)
        .not("employee_id", "is", null),
    ]);

    if (employees.error) throw employees.error;
    if (assignments.error) throw assignments.error;
    if (timeEntries.error) throw timeEntries.error;

    res.json(
      employees.data.map((e) => {
        const currentProject = (assignments.data as any[]).find((a) => a.employee_id === e.id)?.projects?.name ?? null;
        const hoursThisPeriod = (timeEntries.data as any[])
          .filter((t) => t.employee_id === e.id && t.check_out_time)
          .reduce((sum, t) => {
            const ms = new Date(t.check_out_time).getTime() - new Date(t.check_in_time).getTime();
            return sum + ms / 3600000;
          }, 0);
        return {
          id: e.id,
          name: e.name,
          role: e.role,
          phone: e.phone,
          status: e.status,
          hourlyRate: e.hourly_rate === null ? null : Number(e.hourly_rate),
          currentProject,
          hoursThisPeriod: Math.round(hoursThisPeriod),
        };
      })
    );
  })
);

// Creating an employee also opens their chat_channel invitation — they see
// and accept it from /campo before they can send or receive anything there.
apiRouter.post(
  "/employees",
  route(async (req, res) => {
    const { name, role, phone } = req.body ?? {};
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("employees")
      .insert({ business_id: req.businessId!, name, role: role ?? null, phone: phone ?? null, status: "disponible" })
      .select("id")
      .single();
    if (error) throw error;

    await supabase.from("chat_channels").insert({
      business_id: req.businessId!,
      system: "interno",
      label: "trabajador",
      participant_type: "employee",
      participant_id: data.id,
      status: "invitado",
    });

    res.status(201).json({ id: data.id });
  })
);

// Issues a fresh access token for the worker PWA (/campo) login — only the
// hash is stored, so the raw token is shown to the admin exactly once here.
apiRouter.post(
  "/employees/:id/access-token",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const token = randomBytes(9).toString("base64url");
    const { error } = await supabase
      .from("employees")
      .update({ access_token_hash: hashToken(token) })
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);
    if (error) throw error;
    res.json({ token });
  })
);

// ---------- Subcontractors ----------

apiRouter.get(
  "/subcontractors",
  route(async (req, res) => {
    const supabase = req.supabase!;

    const [subcontractors, assignments] = await Promise.all([
      supabase
        .from("subcontractors")
        .select("id, name, trade, phone, rating, hourly_rate, access_token_hash")
        .eq("business_id", req.businessId!)
        .order("name"),
      supabase
        .from("assignments")
        .select("subcontractor_id, projects(name)")
        .eq("business_id", req.businessId!)
        .not("subcontractor_id", "is", null),
    ]);

    if (subcontractors.error) throw subcontractors.error;
    if (assignments.error) throw assignments.error;

    res.json(
      subcontractors.data.map((s) => ({
        id: s.id,
        name: s.name,
        trade: s.trade,
        phone: s.phone,
        rating: s.rating,
        hourlyRate: s.hourly_rate === null ? null : Number(s.hourly_rate),
        // Whether they can actually open the field app — the only "linked or
        // not" state this product really has for a subcontractor.
        hasAccessCode: Boolean(s.access_token_hash),
        assignedProjects: (assignments.data as any[])
          .filter((a) => a.subcontractor_id === s.id)
          .map((a) => a.projects?.name)
          .filter(Boolean),
      }))
    );
  })
);

// Same invitation pattern as employees above.
apiRouter.post(
  "/subcontractors",
  route(async (req, res) => {
    const { name, trade, phone } = req.body ?? {};
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("subcontractors")
      .insert({ business_id: req.businessId!, name, trade: trade ?? null, phone: phone ?? null })
      .select("id")
      .single();
    if (error) throw error;

    await supabase.from("chat_channels").insert({
      business_id: req.businessId!,
      system: "interno",
      label: "subcontrato",
      participant_type: "subcontractor",
      participant_id: data.id,
      status: "invitado",
    });

    res.status(201).json({ id: data.id });
  })
);

apiRouter.post(
  "/subcontractors/:id/access-token",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const token = randomBytes(9).toString("base64url");
    const { error } = await supabase
      .from("subcontractors")
      .update({ access_token_hash: hashToken(token) })
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);
    if (error) throw error;
    res.json({ token });
  })
);

// ---------- GPS & Routing ----------

apiRouter.get(
  "/gps",
  route(async (req, res) => {
    const supabase = req.supabase!;

    const [employees, subcontractors, assignments] = await Promise.all([
      supabase
        .from("employees")
        .select("id, name, status")
        .eq("business_id", req.businessId!)
        .eq("status", "en_proyecto"),
      supabase
        .from("subcontractors")
        .select("id, name")
        .eq("business_id", req.businessId!),
      supabase
        .from("assignments")
        .select("employee_id, subcontractor_id, projects(name)")
        .eq("business_id", req.businessId!),
    ]);

    if (employees.error) throw employees.error;
    if (subcontractors.error) throw subcontractors.error;
    if (assignments.error) throw assignments.error;

    const activeEmployees = employees.data.map((e) => ({
      id: e.id,
      name: e.name,
      kind: "employee" as const,
      currentProject: (assignments.data as any[]).find((a) => a.employee_id === e.id)?.projects?.name ?? null,
    }));

    const assignedSubIds = new Set((assignments.data as any[]).filter((a) => a.subcontractor_id).map((a) => a.subcontractor_id));
    const activeSubcontractors = subcontractors.data
      .filter((s) => assignedSubIds.has(s.id))
      .map((s) => ({
        id: s.id,
        name: s.name,
        kind: "subcontractor" as const,
        currentProject: (assignments.data as any[]).find((a) => a.subcontractor_id === s.id)?.projects?.name ?? null,
      }));

    // Where people actually are comes from their check-ins, which already
    // record coordinates — so the map plots real positions instead of waiting
    // on a maps API key that was never going to arrive.
    const positionColumns =
      "id, employee_id, subcontractor_id, project_id, service_type, check_in_time, check_in_lat, check_in_lng, check_out_time, projects(name), employees(name), subcontractors(name)";

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recent, error: pingsError } = await supabase
      .from("time_entries")
      .select(positionColumns)
      .eq("business_id", req.businessId!)
      .gte("check_in_time", since)
      .not("check_in_lat", "is", null)
      .order("check_in_time", { ascending: false });
    if (pingsError) throw pingsError;

    // Nothing today does not mean nothing to show. Falling back to each
    // person's last known position keeps the map a map on a Monday morning
    // instead of an empty box — marked stale, because where somebody was on
    // Friday is history and must never read as where they are now.
    let pings = recent ?? [];
    let stale = false;
    if (pings.length === 0) {
      const { data: older } = await supabase
        .from("time_entries")
        .select(positionColumns)
        .eq("business_id", req.businessId!)
        .not("check_in_lat", "is", null)
        .order("check_in_time", { ascending: false })
        .limit(60);

      // One pin per person: their most recent. A trail of last week's
      // check-ins would be clutter, not information.
      const seen = new Set<string>();
      pings = ((older ?? []) as any[]).filter((p) => {
        const workerId = p.employee_id ?? p.subcontractor_id ?? p.id;
        if (seen.has(workerId)) return false;
        seen.add(workerId);
        return true;
      });
      stale = pings.length > 0;
    }

    // What each of them is meant to be doing today. Tapping a marker should
    // answer "and what's next", not just "here is a dot" — and comparing the
    // two is the only way the map can say somebody is running late.
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const { data: todaysWork } = await supabase
      .from("schedule_events")
      .select("id, title, type, start_time, end_time, assigned_employee_id, assigned_subcontractor_id, projects(name)")
      .eq("business_id", req.businessId!)
      .gte("start_time", dayStart.toISOString())
      .lt("start_time", dayEnd.toISOString())
      .order("start_time");

    const now = Date.now();
    const scheduleFor = (workerId: string | null) => {
      if (!workerId) return [];
      return ((todaysWork ?? []) as any[])
        .filter((e) => e.assigned_employee_id === workerId || e.assigned_subcontractor_id === workerId)
        .map((e) => ({
          id: e.id,
          title: e.title,
          projectName: e.projects?.name ?? null,
          startTime: e.start_time,
          endTime: e.end_time,
          // Should have started and has not been finished: that is the whole
          // definition of late that this data can honestly support.
          late: new Date(e.start_time).getTime() < now && new Date(e.end_time).getTime() > now,
          done: new Date(e.end_time).getTime() <= now,
        }));
    };

    // Somewhere for the map to open when there is no position at all — the
    // first morning of using the product, which must not look broken. It is a
    // nicety, so it is never allowed to take the screen down with it: the
    // positions are the point, and they came from the query above.
    let center = null;
    try {
      // The caller's own session, not the admin client: this is their own
      // business row, RLS already lets them read and write it, and one less
      // service-role dependency is one less thing to misconfigure.
      center = await businessCoordinates(supabase, req.businessId!);
    } catch (err) {
      console.error("[gps] could not resolve the business location", err);
    }

    res.json({
      workers: [...activeEmployees, ...activeSubcontractors],
      center,
      stale,
      locations: (pings as any[]).map((p) => {
        const workerId = p.employee_id ?? p.subcontractor_id ?? null;
        const schedule = scheduleFor(workerId);
        const onSite = !p.check_out_time;
        return {
          id: p.id,
          workerId,
          name: p.employees?.name ?? p.subcontractors?.name ?? null,
          projectName: p.projects?.name ?? null,
          serviceType: p.service_type,
          lat: Number(p.check_in_lat),
          lng: Number(p.check_in_lng),
          checkInTime: p.check_in_time,
          checkOutTime: p.check_out_time,
          stillOnSite: onSite,
          // The rest of their day, so the card can say what comes next.
          schedule,
          // Late only means something for somebody currently on the clock: a
          // job that should be under way and a person who is not on it.
          late: onSite && schedule.some((e) => e.late && e.projectName !== (p.projects?.name ?? null)),
        };
      }),
    });
  })
);

// ---------- Check-in / Check-out ----------

apiRouter.get(
  "/time-entries",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("time_entries")
      .select(
        "id, check_in_time, check_in_location, check_out_time, approved, projects(name), employees(name), subcontractors(name)"
      )
      .eq("business_id", req.businessId!)
      .order("check_in_time", { ascending: false });

    if (error) throw error;

    res.json(
      data.map((t: any) => ({
        id: t.id,
        projectName: t.projects?.name ?? null,
        workerName: t.employees?.name ?? t.subcontractors?.name ?? null,
        checkInTime: t.check_in_time,
        checkInLocation: t.check_in_location,
        checkOutTime: t.check_out_time,
        approved: t.approved,
      }))
    );
  })
);

apiRouter.patch(
  "/time-entries/:id/approve",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { error } = await supabase
      .from("time_entries")
      .update({ approved: true })
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);

    if (error) throw error;
    res.json({ ok: true });
  })
);

// ---------- Work Orders ----------

apiRouter.get(
  "/work-orders",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("work_orders")
      .select("id, title, description, priority, status, projects(name), employees:assigned_employee_id(name), subcontractors:assigned_subcontractor_id(name)")
      .eq("business_id", req.businessId!);

    if (error) throw error;

    res.json(
      data.map((w: any) => ({
        id: w.id,
        title: w.title,
        description: w.description,
        priority: w.priority,
        status: w.status,
        projectName: w.projects?.name ?? null,
        assignedTo: w.employees?.name ?? w.subcontractors?.name ?? null,
      }))
    );
  })
);

apiRouter.post(
  "/work-orders",
  route(async (req, res) => {
    const { projectId, title, description, priority, assignedEmployeeId, assignedSubcontractorId } = req.body ?? {};
    if (!projectId || !title?.trim()) {
      res.status(400).json({ error: "projectId and title are required" });
      return;
    }
    if (priority && !["baja", "media", "alta"].includes(priority)) {
      res.status(400).json({ error: "priority must be baja, media or alta" });
      return;
    }
    // The table allows at most one assignee; reject the ambiguous case up
    // front rather than letting the constraint produce a cryptic error.
    if (assignedEmployeeId && assignedSubcontractorId) {
      res.status(400).json({ error: "Assign either an employee or a subcontractor, not both" });
      return;
    }

    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("work_orders")
      .insert({
        business_id: req.businessId!,
        project_id: projectId,
        title: title.trim(),
        description: description?.trim() || null,
        priority: priority || "media",
        status: "pendiente",
        assigned_employee_id: assignedEmployeeId || null,
        assigned_subcontractor_id: assignedSubcontractorId || null,
      })
      .select("id")
      .single();
    if (error) throw error;
    res.status(201).json({ id: data.id });
  })
);

// ---------- Scheduling ----------

apiRouter.get(
  "/schedule-events",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("schedule_events")
      .select(
        "id, title, type, start_time, end_time, notes, project_id, projects(name), employees:assigned_employee_id(id, name), subcontractors:assigned_subcontractor_id(id, name)"
      )
      .eq("business_id", req.businessId!)
      .order("start_time");

    if (error) throw error;

    res.json(
      data.map((s: any) => ({
        id: s.id,
        title: s.title,
        type: s.type,
        startTime: s.start_time,
        endTime: s.end_time,
        notes: s.notes,
        projectId: s.project_id,
        projectName: s.projects?.name ?? null,
        assignedWorkerId: s.employees?.id ?? s.subcontractors?.id ?? null,
        assignedWorkerName: s.employees?.name ?? s.subcontractors?.name ?? null,
      }))
    );
  })
);

apiRouter.post(
  "/schedule-events",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const body = req.body ?? {};

    if (!body.projectId || !body.title || !body.startTime || !body.endTime) {
      res.status(400).json({ error: "projectId, title, startTime and endTime are required" });
      return;
    }
    if (body.assignedEmployeeId && body.assignedSubcontractorId) {
      res.status(400).json({ error: "Assign to only one worker, not both" });
      return;
    }

    const { data, error } = await supabase
      .from("schedule_events")
      .insert({
        business_id: req.businessId!,
        project_id: body.projectId,
        title: body.title,
        type: body.type ?? "reunion",
        start_time: body.startTime,
        end_time: body.endTime,
        notes: body.notes ?? null,
        assigned_employee_id: body.assignedEmployeeId ?? null,
        assigned_subcontractor_id: body.assignedSubcontractorId ?? null,
      })
      .select("id")
      .single();

    if (error) throw error;

    await advanceAndBill(getSupabaseAdmin(), {
      businessId: req.businessId!,
      projectId: body.projectId,
      trigger: "trabajo_programado",
      actor: "admin",
    });

    res.status(201).json({ id: data.id });
  })
);

// ---------- Appointment requests (hybrid chat, scoped free text) ----------
// A client's "Agendar cita" bubble opens two scoped free-text questions
// (when + why), never a real slot pick — this is the pending request that
// results in. Confirming here is the only thing that ever writes a real
// schedule_events row for it; rejecting just closes the request. The
// public chat UI that creates these doesn't exist yet (Fase D) — this is
// the admin-side half plus the data model, buildable and testable now.

apiRouter.get(
  "/appointment-requests",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("appointment_requests")
      .select("id, client_id, requested_datetime_text, reason_text, status, schedule_event_id, created_at, clients(name)")
      .eq("business_id", req.businessId!)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json(
      data.map((r: any) => ({
        id: r.id,
        clientId: r.client_id,
        clientName: r.clients?.name ?? null,
        requestedDatetimeText: r.requested_datetime_text,
        reasonText: r.reason_text,
        status: r.status,
        scheduleEventId: r.schedule_event_id,
        createdAt: r.created_at,
      }))
    );
  })
);

// Exposed for the future public chat to call once it exists (Fase D) —
// exercised today via direct API calls / tests, not yet from any UI.
apiRouter.post(
  "/appointment-requests",
  route(async (req, res) => {
    const { clientId, requestedDatetimeText, reasonText } = req.body ?? {};
    if (!clientId || !requestedDatetimeText) {
      res.status(400).json({ error: "clientId and requestedDatetimeText are required" });
      return;
    }

    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("appointment_requests")
      .insert({
        business_id: req.businessId!,
        client_id: clientId,
        requested_datetime_text: requestedDatetimeText,
        reason_text: reasonText ?? null,
      })
      .select("id")
      .single();

    if (error) throw error;
    res.status(201).json({ id: data.id });
  })
);

// Admin picks the real slot — this is the only path that ever creates a
// schedule_events row for a client-requested appointment.
apiRouter.patch(
  "/appointment-requests/:id/confirm",
  route(async (req, res) => {
    const { startTime, durationMinutes, assignedEmployeeId, assignedSubcontractorId } = req.body ?? {};
    if (!startTime || !durationMinutes) {
      res.status(400).json({ error: "startTime and durationMinutes are required" });
      return;
    }
    if (assignedEmployeeId && assignedSubcontractorId) {
      res.status(400).json({ error: "Assign to only one worker, not both" });
      return;
    }

    const supabase = req.supabase!;
    const { data: reqRow, error: reqError } = await supabase
      .from("appointment_requests")
      .select("client_id, reason_text, clients(name)")
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id)
      .single();
    if (reqError) throw reqError;

    const endTime = new Date(new Date(startTime).getTime() + durationMinutes * 60000).toISOString();
    const clientName = (reqRow.clients as any)?.name ?? "Cliente";

    const { data: event, error: eventError } = await supabase
      .from("schedule_events")
      .insert({
        business_id: req.businessId!,
        project_id: null,
        title: `Cita con ${clientName}`,
        type: "reunion",
        start_time: startTime,
        end_time: endTime,
        notes: reqRow.reason_text,
        assigned_employee_id: assignedEmployeeId ?? null,
        assigned_subcontractor_id: assignedSubcontractorId ?? null,
        source: "chat_cliente",
      })
      .select("id")
      .single();
    if (eventError) throw eventError;

    const { error: updateError } = await supabase
      .from("appointment_requests")
      .update({ status: "confirmada", schedule_event_id: event.id })
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);
    if (updateError) throw updateError;

    res.json({ ok: true, scheduleEventId: event.id });
  })
);

apiRouter.patch(
  "/appointment-requests/:id/reject",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { error } = await supabase
      .from("appointment_requests")
      .update({ status: "rechazada" })
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);

    if (error) throw error;
    res.json({ ok: true });
  })
);

// ---------- Stripe Connect ----------
// Each business owns and manages its own Stripe account — this only ever
// orchestrates the Express onboarding handshake and reads back its status;
// it never touches the connected account's balance or payout schedule.

apiRouter.get(
  "/stripe/connect/status",
  route(async (req, res) => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("stripe_connected_accounts")
      .select("stripe_account_id, status, charges_enabled, payouts_enabled, details_submitted, fees_payer")
      .eq("business_id", req.businessId!)
      .maybeSingle();
    if (error) throw error;
    const { data: business } = await admin
      .from("businesses")
      .select("payments_mode")
      .eq("id", req.businessId!)
      .maybeSingle();
    res.json({
      paymentsMode: business?.payments_mode ?? "sin_definir",
      connected: !!data?.stripe_account_id,
      status: data?.status ?? "pending",
      chargesEnabled: data?.charges_enabled ?? false,
      payoutsEnabled: data?.payouts_enabled ?? false,
      detailsSubmitted: data?.details_submitted ?? false,
      // Fixed when the account was created and unchangeable afterwards, so an
      // account that predates the fee-safe setup has to be replaced rather
      // than corrected. The page says so instead of leaving it to be found on
      // a Stripe invoice at the end of the month.
      feesPayer: data?.fees_payer ?? null,
    });
  })
);

// The business choosing how it gets paid. "manual" is a real answer, not a
// failure to answer: a contractor who invoices by e-transfer and deposits
// cheques is running a normal business, and the panel should stop asking.
apiRouter.post(
  "/settings/payments-mode",
  route(async (req, res) => {
    const mode = req.body?.mode;
    if (!["sin_definir", "stripe", "manual"].includes(mode)) {
      res.status(400).json({ error: "invalid mode" });
      return;
    }
    const { error } = await getSupabaseAdmin()
      .from("businesses")
      .update({ payments_mode: mode, payments_mode_set_at: new Date().toISOString() })
      .eq("id", req.businessId!);
    if (error) throw error;
    res.json({ ok: true, mode });
  })
);

// Creates the Express account on first call (idempotent afterward) and
// always returns a fresh onboarding link — Stripe's account links expire
// quickly and are meant to be requested right before redirecting the user.
apiRouter.post(
  "/stripe/connect/onboarding-link",
  route(async (req, res) => {
    const admin = getSupabaseAdmin();
    const stripe = getStripe();
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    let { data: account } = await admin
      .from("stripe_connected_accounts")
      .select("stripe_account_id")
      .eq("business_id", req.businessId!)
      .maybeSingle();

    if (!account?.stripe_account_id) {
      const { data: business } = await admin
        .from("businesses")
        .select("name, email")
        .eq("id", req.businessId!)
        .single();
      let created;
      try {
        created = await createConnectedAccount(stripe, business?.name, business?.email);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (isConnectNotEnabled(message)) {
          res.status(409).json({ error: message, code: "stripe_connect_not_enabled" });
          return;
        }
        throw err;
      }
      // Starting onboarding answers the question; no need to ask again.
      await admin
        .from("businesses")
        .update({ payments_mode: "stripe", payments_mode_set_at: new Date().toISOString() })
        .eq("id", req.businessId!);

      const { data: inserted, error: insertError } = await admin
        .from("stripe_connected_accounts")
        .upsert(
          {
            business_id: req.businessId!,
            stripe_account_id: created.account.id,
            status: "pending",
            fees_payer: created.feesPayer,
          },
          { onConflict: "business_id" }
        )
        .select("stripe_account_id")
        .single();
      if (insertError) throw insertError;
      account = inserted;
    }

    let link;
    try {
      link = await stripe.v2.core.accountLinks.create(
        {
          account: account.stripe_account_id!,
          use_case: {
            type: "account_onboarding",
            account_onboarding: {
              // Only the merchant configuration is onboarded: this platform
              // charges no subscription through Stripe, so asking a contractor
              // for customer-configuration details would be asking for
              // paperwork nothing will ever use.
              configurations: ["merchant"],
              // These must be routes that exist in client/src/App.tsx.
              // They said /settings/pagos while the route is
              // /settings/payments, so Stripe returned every contractor who
              // finished onboarding to a 404 — the worst possible moment to
              // show one, right after they handed over their bank details.
              refresh_url: `${baseUrl}/settings/payments`,
              return_url: `${baseUrl}/settings/payments?onboarding=completo`,
            },
          },
        } as never,
        { apiVersion: STRIPE_V2_VERSION } as never
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (isConnectNotEnabled(message)) {
        res.status(409).json({ error: message, code: "stripe_connect_not_enabled" });
        return;
      }
      // The id we stored no longer exists at Stripe — the account was deleted
      // there, or it belongs to a different Stripe key than the one now
      // configured. Left alone the business is stuck forever: our row says
      // connected, Stripe says no such account, and every retry repeats it.
      // Dropping the row lets the next attempt create a fresh one.
      if (/No such account|resource_missing/i.test(message)) {
        await admin.from("stripe_connected_accounts").delete().eq("business_id", req.businessId!);
        res.status(409).json({ error: message, code: "stripe_account_missing" });
        return;
      }
      throw err;
    }

    res.json({ url: link.url });
  })
);

// Sets up this deployment's Stripe webhook without anybody copying a secret.
//
// Behind business auth on purpose: it is a platform-wide action, and the only
// people who reach this router are the ones running the business panel.
apiRouter.post(
  "/stripe/webhook/provision",
  route(async (req, res) => {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const result = await provisionWebhook(getSupabaseAdmin(), baseUrl);
    res.json(result);
  })
);

// Called when the business lands back from Stripe's onboarding flow, to
// pull the account's real charges/payouts capability instead of guessing.
apiRouter.post(
  "/stripe/connect/refresh",
  route(async (req, res) => {
    const admin = getSupabaseAdmin();
    const { data: account } = await admin
      .from("stripe_connected_accounts")
      .select("stripe_account_id")
      .eq("business_id", req.businessId!)
      .maybeSingle();
    if (!account?.stripe_account_id) {
      res.status(404).json({ error: "No hay una cuenta de Stripe para este negocio" });
      return;
    }

    const stripe = getStripe();
    // Still the v1 read, on purpose. Accounts must now be *created* through
    // v2, but v1 keeps answering for them and it is the shape that carries
    // charges_enabled / payouts_enabled / details_submitted in one object —
    // checked against a v2-created account, which returns all three.
    const remote = await stripe.accounts.retrieve(account.stripe_account_id);
    const status = remote.charges_enabled ? "active" : remote.requirements?.disabled_reason ? "restricted" : "pending";

    await admin
      .from("stripe_connected_accounts")
      .update({
        charges_enabled: !!remote.charges_enabled,
        payouts_enabled: !!remote.payouts_enabled,
        details_submitted: !!remote.details_submitted,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("business_id", req.businessId!);

    res.json({
      connected: true,
      status,
      chargesEnabled: !!remote.charges_enabled,
      payoutsEnabled: !!remote.payouts_enabled,
      detailsSubmitted: !!remote.details_submitted,
    });
  })
);

// What is at Stripe and what has reached the bank. Reads the connected
// account, never this platform's balance.
apiRouter.get(
  "/reports/stripe-balance",
  route(async (req, res) => {
    const to = new Date();
    const from = new Date(to.getTime() - 90 * 86_400_000);
    try {
      res.json(await stripeBalance(getSupabaseAdmin(), req.businessId!, from, to));
    } catch (err) {
      // Stripe being unreachable must not take down the reports page: the
      // rest of it is read from our own database and still true.
      if (err instanceof StripeNotConfiguredError) {
        res.json({ connected: false, currency: "cad", available: 0, pending: 0, feesInPeriod: 0, chargedInPeriod: 0, deposits: [], payoutsBlockedReason: null });
        return;
      }
      throw err;
    }
  })
);

// The books as a file the accountant can import. One kind per call so the
// columns stay meaningful — a single sheet mixing invoices, payments and
// expenses is one nobody can map.
apiRouter.get(
  "/reports/accounting-export",
  route(async (req, res) => {
    const kind = String(req.query.kind ?? "invoices") as ExportKind;
    if (!["invoices", "payments", "expenses"].includes(kind)) {
      res.status(400).json({ error: "kind must be invoices, payments or expenses" });
      return;
    }
    // A year to date by default: the range somebody exporting the books wants
    // far more often than any other.
    const year = new Date().getFullYear();
    const from = String(req.query.from ?? `${year}-01-01`);
    const to = String(req.query.to ?? new Date().toISOString().slice(0, 10));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      res.status(400).json({ error: "from and to must be YYYY-MM-DD" });
      return;
    }

    const result = await exportAccounting(req.supabase! as never, req.businessId!, kind, from, to);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.send(result.csv);
  })
);

// Is each job making money. The caller's session reads the project figures;
// the admin client is passed alongside because labour cost comes from pay
// rates, which no ordinary session is allowed to see.
apiRouter.get(
  "/reports/profitability",
  route(async (req, res) => {
    res.json(await profitabilityByProject(req.supabase! as never, getSupabaseAdmin(), req.businessId!));
  })
);

// Who owes money and since when. Read with the caller's own session so RLS
// scopes it, like every other report on this side of the gate.
apiRouter.get(
  "/reports/receivables",
  route(async (req, res) => {
    res.json(await receivables(req.supabase! as never, req.businessId!));
  })
);

// ---------- Invoicing & Payments ----------

apiRouter.get(
  "/invoices",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("invoices")
      .select(
        "id, type, amount, subtotal, tax_amount, tax_breakdown, holdback_amount, holdback_released, status, due_date, description, created_at, paid_at, projects(name), clients(name)"
      )
      .eq("business_id", req.businessId!)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json(
      data.map((i: any) => ({
        id: i.id,
        type: i.type,
        amount: Number(i.amount),
        subtotal: Number(i.subtotal),
        taxAmount: Number(i.tax_amount),
        taxBreakdown: i.tax_breakdown,
        // The panel already had a line for the withheld amount and it never
        // appeared: the field was simply not being sent.
        holdbackAmount: Number(i.holdback_amount ?? 0),
        holdbackReleased: Number(i.holdback_released ?? 0),
        status: i.status,
        dueDate: i.due_date,
        description: i.description,
        createdAt: i.created_at,
        paidAt: i.paid_at,
        projectName: i.projects?.name ?? null,
        clientName: i.clients?.name ?? null,
      }))
    );
  })
);

// Subtotal comes in pre-tax; tax is computed here from the business's own
// province so nobody has to remember GST/QST/HST math by hand.
apiRouter.post(
  "/invoices",
  route(async (req, res) => {
    const { clientId, projectId, estimateId, type, subtotal, dueDate, description } = req.body ?? {};
    if (!clientId || !type || !subtotal || Number(subtotal) <= 0) {
      res.status(400).json({ error: "clientId, type and a positive subtotal are required" });
      return;
    }
    if (!["deposito", "parcial", "final"].includes(type)) {
      res.status(400).json({ error: "type must be deposito, parcial or final" });
      return;
    }

    const id = await createInvoiceRecord(getSupabaseAdmin(), {
      businessId: req.businessId!,
      clientId,
      projectId: projectId ?? null,
      estimateId: estimateId ?? null,
      type,
      subtotal: Number(subtotal),
      description: description ?? null,
      dueDate: dueDate ?? null,
    });
    res.status(201).json({ id });
  })
);

// What was planned for each worker against what they actually did.
//
// Deliberately three numbers rather than a score: hours planned, hours worked,
// and jobs that passed with nobody on them. A single "efficiency %" flattens a
// crew who worked longer than planned and a crew who skipped a job into the
// same figure, and those are different conversations.
apiRouter.get(
  "/reports/worker-performance",
  route(async (req, res) => {
    const from = String(req.query.from ?? "");
    const to = String(req.query.to ?? "");
    if (!from || !to) {
      res.status(400).json({ error: "from and to are required" });
      return;
    }
    res.json({ workers: await workerPerformance(getSupabaseAdmin(), req.businessId!, from, to) });
  })
);

// ---------- Payment requests ----------
// Asking a customer for money inside the conversation they are already in.
// See server/paymentRequests.ts for why a percentage stays a percentage until
// it is sent, and why sending is idempotent by status.

/** The two things every send needs: an invoice, and a message carrying it. */
function paymentRequestDeps(admin: ReturnType<typeof getSupabaseAdmin>) {
  return {
    createInvoice: (args: {
      businessId: string;
      clientId: string;
      projectId: string | null;
      type: "deposito" | "parcial" | "final";
      chargeKind: "proyecto" | "extra";
      subtotal: number;
      description: string;
    }) =>
      createInvoiceRecord(admin, {
        businessId: args.businessId,
        clientId: args.clientId,
        projectId: args.projectId,
        estimateId: null,
        type: args.type,
        subtotal: args.subtotal,
        description: args.description || null,
        chargeKind: args.chargeKind,
      }),
    postToChat: async (args: { businessId: string; clientId: string; invoiceId: string; content: string }) => {
      const channelId = await ensureClientChannel(admin, args.businessId, args.clientId);
      const { data: channel } = await admin
        .from("chat_channels")
        .select("disappearing_duration")
        .eq("id", channelId)
        .maybeSingle();
      const { data: message, error } = await admin
        .from("chat_messages")
        .insert({
          channel_id: channelId,
          business_id: args.businessId,
          sender_type: "admin",
          sender_id: null,
          content: args.content || documentNumber("invoice", args.invoiceId),
          attachment_kind: "invoice",
          attachment_id: args.invoiceId,
          attachment_name: `${documentNumber("invoice", args.invoiceId)}.pdf`,
          attachment_mime: "application/pdf",
          expires_at: computeExpiresAt(channel?.disappearing_duration ?? null),
        })
        .select("id")
        .single();
      if (error) throw error;
      return message.id;
    },
  };
}

apiRouter.get(
  "/payment-requests",
  route(async (req, res) => {
    const admin = getSupabaseAdmin();
    // Anything due goes out while somebody is looking at the list, which is
    // the closest this product gets to a scheduler.
    await sweepDueRequests(admin, req.businessId!, paymentRequestDeps(admin));

    const { data, error } = await admin
      .from("payment_requests")
      .select(
        "id, kind, basis, percent, amount, description, status, send_at, sent_at, invoice_id, clients(name), projects(name), invoices(amount, status)"
      )
      .eq("business_id", req.businessId!)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;

    res.json(
      (data ?? []).map((r: any) => ({
        id: r.id,
        kind: r.kind,
        basis: r.basis,
        percent: r.percent === null ? null : Number(r.percent),
        amount: r.amount === null ? null : Number(r.amount),
        description: r.description,
        status: r.status,
        sendAt: r.send_at,
        sentAt: r.sent_at,
        clientName: r.clients?.name ?? null,
        projectName: r.projects?.name ?? null,
        invoiceId: r.invoice_id,
        // Only once it exists — before that there is nothing anybody agreed to.
        invoiceAmount: r.invoices?.amount === undefined ? null : Number(r.invoices.amount),
        invoiceStatus: r.invoices?.status ?? null,
      }))
    );
  })
);

apiRouter.post(
  "/payment-requests",
  route(async (req, res) => {
    const { clientId, projectId, kind, basis, percent, amount, description, sendAt } = req.body ?? {};
    if (!clientId || !["proyecto", "extra"].includes(kind) || !["porcentaje", "monto"].includes(basis)) {
      res.status(400).json({ error: "clientId, kind and basis are required" });
      return;
    }
    if (basis === "porcentaje") {
      const pct = Number(percent);
      if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
        res.status(400).json({ error: "percent must be between 0 and 100" });
        return;
      }
      // A share of nothing is not a charge; say so instead of sending $0.
      if (!projectId) {
        res.status(400).json({ error: "a percentage needs a project", code: "percent_needs_project" });
        return;
      }
    } else {
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) {
        res.status(400).json({ error: "amount must be positive" });
        return;
      }
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("payment_requests")
      .insert({
        business_id: req.businessId!,
        client_id: clientId,
        project_id: projectId || null,
        kind,
        basis,
        percent: basis === "porcentaje" ? Number(percent) : null,
        amount: basis === "monto" ? Number(amount) : null,
        description: description?.trim() || null,
        send_at: sendAt || null,
      })
      .select("id, business_id, client_id, project_id, kind, basis, percent, amount, description, status, send_at")
      .single();
    if (error) throw error;

    // No date means now. Anything else waits for its day.
    if (!sendAt) {
      const sent = await sendPaymentRequest(admin, data.id, paymentRequestDeps(admin));
      res.status(201).json({ id: data.id, sent: Boolean(sent), amount: sent?.amount ?? null });
      return;
    }
    res.status(201).json({ id: data.id, sent: false, amount: await resolveAmount(admin, data as never) });
  })
);

// Sending a scheduled one early — the customer who offers to pay now.
apiRouter.post(
  "/payment-requests/:id/send",
  route(async (req, res) => {
    const admin = getSupabaseAdmin();
    const { data: owned } = await admin
      .from("payment_requests")
      .select("id")
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id)
      .maybeSingle();
    if (!owned) {
      res.status(404).json({ error: "request not found" });
      return;
    }
    const sent = await sendPaymentRequest(admin, req.params.id, paymentRequestDeps(admin));
    if (!sent) {
      res.status(409).json({ error: "nothing to send", code: "not_sendable" });
      return;
    }
    res.status(201).json(sent);
  })
);

apiRouter.delete(
  "/payment-requests/:id",
  route(async (req, res) => {
    // Cancelled rather than deleted once sent: the invoice and the message
    // already exist, and pretending the ask never happened would leave both
    // orphaned in front of the customer.
    const { error } = await getSupabaseAdmin()
      .from("payment_requests")
      .update({ status: "cancelado" })
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id)
      .in("status", ["programado", "enviado"]);
    if (error) throw error;
    res.json({ ok: true });
  })
);

// ---------- Payroll ----------
// Everything under here is the office's. No /worker/* route reads a rate or a
// run: what somebody earns is between them and the office, and the field app
// has no business knowing what the person beside them costs.

apiRouter.get(
  "/payroll/deductions",
  route(async (req, res) => {
    const rules = await readDeductions(getSupabaseAdmin(), req.businessId!);
    res.json(rules);
  })
);

apiRouter.put(
  "/payroll/deductions",
  route(async (req, res) => {
    const rows = Array.isArray(req.body?.deductions) ? req.body.deductions : null;
    if (!rows) {
      res.status(400).json({ error: "deductions must be a list" });
      return;
    }
    const cleaned = rows.map((d: Record<string, unknown>, index: number) => ({
      position: index + 1,
      code: String(d.code ?? `linea_${index + 1}`).trim() || `linea_${index + 1}`,
      label: String(d.label ?? "").trim(),
      paid_by: d.paidBy === "empleador" ? "empleador" : "empleado",
      rate_percent: Number(d.ratePercent ?? 0),
      annual_exemption: Number(d.annualExemption ?? 0),
      annual_maximum:
        d.annualMaximum === null || d.annualMaximum === undefined || d.annualMaximum === ""
          ? null
          : Number(d.annualMaximum),
      enabled: d.enabled !== false,
      source_note: d.sourceNote ? String(d.sourceNote) : null,
      remit_to: d.remitTo ? String(d.remitTo) : "otro",
    }));

    for (const row of cleaned) {
      if (!row.label) {
        res.status(400).json({ error: "every line needs a name" });
        return;
      }
      if (!Number.isFinite(row.rate_percent) || row.rate_percent < 0 || row.rate_percent > 100) {
        res.status(400).json({ error: "every rate must be between 0 and 100" });
        return;
      }
    }

    const admin = getSupabaseAdmin();
    const { error: deleteError } = await admin
      .from("payroll_deductions")
      .delete()
      .eq("business_id", req.businessId!);
    if (deleteError) throw deleteError;
    if (cleaned.length > 0) {
      const { error } = await admin
        .from("payroll_deductions")
        .insert(cleaned.map((row: (typeof cleaned)[number]) => ({ ...row, business_id: req.businessId! })));
      if (error) throw error;
    }
    res.json({ ok: true });
  })
);

// Approved hours per worker for a period, with what each would cost. The
// preview the admin sees before deciding to record anything.
apiRouter.get(
  "/payroll/hours",
  route(async (req, res) => {
    const from = String(req.query.from ?? "");
    const to = String(req.query.to ?? "");
    if (!from || !to) {
      res.status(400).json({ error: "from and to are required" });
      return;
    }
    const admin = getSupabaseAdmin();
    const [workers, rules] = await Promise.all([
      approvedHours(admin, req.businessId!, from, `${to}T23:59:59.999Z`),
      readDeductions(admin, req.businessId!),
    ]);
    const periodDays = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1);

    const year = new Date(to).getUTCFullYear();
    const rows = await Promise.all(
      workers
        .filter((w) => w.hours > 0)
        .map(async (w) => ({
          workerId: w.workerId,
          kind: w.kind,
          name: w.name,
          hourlyRate: w.hourlyRate,
          hours: w.hours,
          overtimeHours: w.overtimeHours,
          // Without a rate there is nothing to compute, and inventing one
          // would put a number in front of somebody that nobody chose.
          breakdown: w.hourlyRate
            ? computePayroll(
                w.hours,
                w.hourlyRate,
                rules,
                periodDays,
                await yearToDate(admin, req.businessId!, w.workerId, w.kind, year)
              )
            : null,
        }))
    );

    res.json({ periodDays, workers: rows });
  })
);

// Recording a breakdown freezes it. Payroll gets argued about months later and
// "regenerate it from today's rates" is the wrong answer — the rates changed
// in January.
apiRouter.post(
  "/payroll/runs",
  route(async (req, res) => {
    const { workerId, kind, from, to } = req.body ?? {};
    if (!workerId || !["employee", "subcontractor"].includes(kind) || !from || !to) {
      res.status(400).json({ error: "workerId, kind, from and to are required" });
      return;
    }
    const admin = getSupabaseAdmin();
    const [workers, rules] = await Promise.all([
      approvedHours(admin, req.businessId!, from, `${to}T23:59:59.999Z`),
      readDeductions(admin, req.businessId!),
    ]);
    const worker = workers.find((w) => w.workerId === workerId && w.kind === kind);
    if (!worker) {
      res.status(404).json({ error: "worker not found for that period" });
      return;
    }
    if (!worker.hourlyRate) {
      res.status(409).json({ error: "this worker has no hourly rate", code: "no_rate" });
      return;
    }
    if (worker.hours <= 0) {
      res.status(409).json({ error: "no approved hours in that period", code: "no_hours" });
      return;
    }

    const periodDays = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1);
    // Against what this person has already contributed this year, so a ceiling
    // stops them the period they actually reach it.
    const ytd = await yearToDate(admin, req.businessId!, workerId, kind, new Date(to).getUTCFullYear());
    const breakdown = computePayroll(worker.hours, worker.hourlyRate, rules, periodDays, ytd);

    const { data, error } = await admin
      .from("payroll_runs")
      .insert({
        business_id: req.businessId!,
        employee_id: kind === "employee" ? workerId : null,
        subcontractor_id: kind === "subcontractor" ? workerId : null,
        worker_name: worker.name,
        period_start: from,
        period_end: to,
        hours: breakdown.hours,
        hourly_rate: breakdown.hourlyRate,
        gross: breakdown.gross,
        employee_deductions: breakdown.employeeDeductions,
        employer_contributions: breakdown.employerContributions,
        net: breakdown.net,
        total_cost: breakdown.totalCost,
        lines: breakdown.lines,
      })
      .select("id")
      .single();
    if (error) throw error;
    res.status(201).json({ id: data.id, ...breakdown });
  })
);

apiRouter.get(
  "/payroll/runs",
  route(async (req, res) => {
    const { data, error } = await getSupabaseAdmin()
      .from("payroll_runs")
      .select("id, worker_name, period_start, period_end, hours, gross, net, total_cost, created_at")
      .eq("business_id", req.businessId!)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    res.json(
      (data ?? []).map((r) => ({
        id: r.id,
        workerName: r.worker_name,
        periodStart: r.period_start,
        periodEnd: r.period_end,
        hours: Number(r.hours),
        gross: Number(r.gross),
        net: Number(r.net),
        totalCost: Number(r.total_cost),
        createdAt: r.created_at,
      }))
    );
  })
);

apiRouter.delete(
  "/payroll/runs/:id",
  route(async (req, res) => {
    const { error } = await getSupabaseAdmin()
      .from("payroll_runs")
      .delete()
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  })
);

// What a worker already earned and paid this year before arriving here.
//
// This is what makes leaving the previous payroll final. Without it a business
// that switched in June starts every ceiling from zero and has to keep the old
// system open beside this one to know when someone actually reached their
// maximum.
apiRouter.get(
  "/payroll/opening-balances",
  route(async (req, res) => {
    const year = Number(req.query.year ?? new Date().getUTCFullYear());
    const admin = getSupabaseAdmin();
    const [balances, rules] = await Promise.all([
      admin
        .from("payroll_opening_balances")
        .select("id, employee_id, subcontractor_id, year, gross, lines, note")
        .eq("business_id", req.businessId!)
        .eq("year", year),
      readDeductions(admin, req.businessId!),
    ]);
    if (balances.error) throw balances.error;

    res.json({
      year,
      // The same lines the payroll uses, so the form to fill is the payslip
      // they are copying from rather than a different vocabulary.
      codes: rules.map((r) => ({ code: r.code, label: r.label, paidBy: r.paidBy, remitTo: r.remitTo })),
      balances: (balances.data ?? []).map((b) => ({
        id: b.id,
        workerId: b.employee_id ?? b.subcontractor_id,
        kind: b.employee_id ? "employee" : "subcontractor",
        gross: Number(b.gross),
        lines: b.lines ?? [],
        note: b.note,
      })),
    });
  })
);

apiRouter.put(
  "/payroll/opening-balances",
  route(async (req, res) => {
    const { workerId, kind, year, gross, lines, note } = req.body ?? {};
    if (!workerId || !["employee", "subcontractor"].includes(kind) || !year) {
      res.status(400).json({ error: "workerId, kind and year are required" });
      return;
    }
    const grossValue = Number(gross ?? 0);
    if (!Number.isFinite(grossValue) || grossValue < 0) {
      res.status(400).json({ error: "gross must be a positive number" });
      return;
    }
    const cleanLines = (Array.isArray(lines) ? lines : [])
      .map((l: Record<string, unknown>) => ({
        code: String(l.code ?? ""),
        label: String(l.label ?? l.code ?? ""),
        paidBy: l.paidBy === "empleador" ? "empleador" : "empleado",
        remitTo: String(l.remitTo ?? "otro"),
        amount: Number(l.amount ?? 0),
      }))
      // A zero carries no information and would clutter every year-end total.
      .filter((l) => l.code && Number.isFinite(l.amount) && l.amount > 0);

    const admin = getSupabaseAdmin();
    const { error } = await admin.from("payroll_opening_balances").upsert(
      {
        business_id: req.businessId!,
        employee_id: kind === "employee" ? workerId : null,
        subcontractor_id: kind === "subcontractor" ? workerId : null,
        year: Number(year),
        gross: grossValue,
        lines: cleanLines,
        note: note || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: kind === "employee" ? "business_id,employee_id,year" : "business_id,subcontractor_id,year" }
    );
    if (error) throw error;
    res.json({ ok: true });
  })
);

// The whole year per worker: issued sheets plus whatever they brought with
// them. These are the figures a T4 and an RL-1 ask for — the software does not
// file those, but holding the numbers is what stops anyone reopening an old
// payroll in December to find them.
apiRouter.get(
  "/payroll/annual",
  route(async (req, res) => {
    const year = Number(req.query.year ?? new Date().getUTCFullYear());
    if (!Number.isFinite(year)) {
      res.status(400).json({ error: "invalid year" });
      return;
    }
    res.json({ year, workers: await annualTotals(getSupabaseAdmin(), req.businessId!, year) });
  })
);

// What has to be remitted, and to whom, for the sheets issued in a period.
//
// The money does not go to one place: RRQ, RQAP and Québec tax to Revenu
// Québec, EI and federal tax to the CRA, CNESST on its own filing. Splitting
// that by hand every period is exactly the manual step this removes.
//
// Built from issued sheets rather than from hours, because a remittance is
// owed on what was actually withheld — a preview nobody committed to is not a
// liability.
apiRouter.get(
  "/payroll/remittance",
  route(async (req, res) => {
    const from = String(req.query.from ?? "");
    const to = String(req.query.to ?? "");
    if (!from || !to) {
      res.status(400).json({ error: "from and to are required" });
      return;
    }
    const { data, error } = await getSupabaseAdmin()
      .from("payroll_runs")
      .select("id, worker_name, gross, lines")
      .eq("business_id", req.businessId!)
      .gte("period_end", from)
      .lte("period_end", to);
    if (error) throw error;

    const runs = data ?? [];
    const byDestination = new Map<
      string,
      { destination: string; employee: number; employer: number; lines: Map<string, { label: string; paidBy: string; amount: number }> }
    >();

    for (const run of runs) {
      for (const raw of (run.lines ?? []) as Array<Record<string, unknown>>) {
        const destination = String(raw.remitTo ?? "otro");
        const code = String(raw.code ?? "");
        const amount = Number(raw.amount ?? 0);
        const paidBy = raw.paidBy === "empleador" ? "empleador" : "empleado";

        let group = byDestination.get(destination);
        if (!group) {
          group = { destination, employee: 0, employer: 0, lines: new Map() };
          byDestination.set(destination, group);
        }
        if (paidBy === "empleado") group.employee = Math.round((group.employee + amount) * 100) / 100;
        else group.employer = Math.round((group.employer + amount) * 100) / 100;

        const existing = group.lines.get(code);
        group.lines.set(code, {
          label: String(raw.label ?? code),
          paidBy,
          amount: Math.round(((existing?.amount ?? 0) + amount) * 100) / 100,
        });
      }
    }

    res.json({
      runCount: runs.length,
      grossTotal: Math.round(runs.reduce((sum, r) => sum + Number(r.gross), 0) * 100) / 100,
      destinations: Array.from(byDestination.values()).map((g) => ({
        destination: g.destination,
        employee: g.employee,
        employer: g.employer,
        total: Math.round((g.employee + g.employer) * 100) / 100,
        lines: Array.from(g.lines.entries()).map(([code, line]) => ({ code, ...line })),
      })),
    });
  })
);

apiRouter.get(
  "/payroll/runs/:id/pdf",
  route(async (req, res) => {
    const pdf = await buildPayrollPdf(req.businessId!, req.params.id, normalizeDocLang(req.query.lang));
    if (!pdf) {
      res.status(404).json({ error: "payroll run not found" });
      return;
    }
    sendPdf(res, pdf, `${documentNumber("payroll", req.params.id)}.pdf`, "attachment");
  })
);

// ---------- Payment plans ----------
// The business's template, and each project's own copy of it. See
// server/paymentPlans.ts for why a project keeps a copy rather than reading
// the template every time.

apiRouter.get(
  "/payment-plan",
  route(async (req, res) => {
    const plan = await readPlan(getSupabaseAdmin(), req.businessId!);
    res.json({ milestones: plan, triggers: MILESTONE_TRIGGERS, isDefault: plan === DEFAULT_PLAN });
  })
);

apiRouter.put(
  "/payment-plan",
  route(async (req, res) => {
    const milestones = Array.isArray(req.body?.milestones) ? req.body.milestones : null;
    if (!milestones || milestones.length === 0) {
      res.status(400).json({ error: "at least one milestone is required" });
      return;
    }
    const cleaned = milestones.map((m: Record<string, unknown>, index: number) => ({
      position: index + 1,
      label: String(m.label ?? "").trim(),
      percent: Number(m.percent),
      trigger: String(m.trigger ?? "manual"),
    }));
    for (const m of cleaned) {
      if (!m.label) {
        res.status(400).json({ error: "every milestone needs a name" });
        return;
      }
      if (!Number.isFinite(m.percent) || m.percent <= 0 || m.percent > 100) {
        res.status(400).json({ error: "every percentage must be between 0 and 100" });
        return;
      }
      if (!MILESTONE_TRIGGERS.includes(m.trigger as never)) {
        res.status(400).json({ error: "invalid trigger" });
        return;
      }
    }
    // Rejected rather than silently normalised: a plan that does not add up to
    // the whole job means one stage bills the wrong amount, and the business
    // needs to see that before it reaches a customer.
    if (!planTotalsCorrectly(cleaned)) {
      res.status(400).json({ error: "percentages must add up to 100", code: "plan_not_100" });
      return;
    }

    const admin = getSupabaseAdmin();
    // Replace wholesale: positions are contiguous by construction, so
    // reconciling row by row would only invent ways to leave a gap.
    const { error: deleteError } = await admin
      .from("payment_plan_milestones")
      .delete()
      .eq("business_id", req.businessId!);
    if (deleteError) throw deleteError;
    const { error } = await admin
      .from("payment_plan_milestones")
      .insert(cleaned.map((m: (typeof cleaned)[number]) => ({ ...m, business_id: req.businessId! })));
    if (error) throw error;
    res.json({ ok: true });
  })
);

apiRouter.get(
  "/projects/:id/payment-milestones",
  route(async (req, res) => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("project_payment_milestones")
      .select("id, position, label, percent, trigger, invoice_id, billed_at, invoices(amount, status, due_date)")
      .eq("business_id", req.businessId!)
      .eq("project_id", req.params.id)
      .order("position");
    if (error) throw error;
    res.json(
      (data ?? []).map((m) => {
        const invoice = m.invoices as unknown as { amount: number; status: string; due_date: string | null } | null;
        return {
          id: m.id,
          position: Number(m.position),
          label: m.label,
          percent: Number(m.percent),
          trigger: m.trigger,
          invoiceId: m.invoice_id,
          billedAt: m.billed_at,
          amount: invoice ? Number(invoice.amount) : null,
          invoiceStatus: invoice?.status ?? null,
          dueDate: invoice?.due_date ?? null,
        };
      })
    );
  })
);

// Billing a stage before its trigger fires — the customer who wants to pay
// early, the job where the deposit is collected on a handshake.
apiRouter.post(
  "/projects/:id/payment-milestones/:milestoneId/bill",
  route(async (req, res) => {
    const admin = getSupabaseAdmin();
    const billed = await billMilestone(admin, {
      businessId: req.businessId!,
      projectId: req.params.id,
      milestoneId: req.params.milestoneId,
      createInvoice: (args) =>
        createInvoiceRecord(admin, {
          businessId: args.businessId,
          clientId: args.clientId,
          projectId: args.projectId,
          estimateId: args.estimateId,
          type: args.type,
          subtotal: args.subtotal,
          description: args.description,
        }),
    });
    if (!billed) {
      res.status(409).json({ error: "nothing to bill for this milestone", code: "milestone_not_billable" });
      return;
    }
    res.status(201).json(billed);
  })
);

apiRouter.post(
  "/invoices/:id/checkout-link",
  route(async (req, res) => {
    const admin = getSupabaseAdmin();
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    try {
      const url = await createInvoiceCheckoutSession(admin, req.businessId!, req.params.id, baseUrl);
      res.json({ url });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "No se pudo crear el link de pago" });
    }
  })
);


// ---------- Catalog write operations (materials, labor rates) ----------
// The catalog is the spine of every estimate, so it has to be editable from
// the app rather than seeded once — a contractor's prices change constantly.

apiRouter.post(
  "/materials",
  route(async (req, res) => {
    const { name, unit, price, category, supplier } = req.body ?? {};
    if (!name?.trim() || !unit?.trim()) {
      res.status(400).json({ error: "name and unit are required" });
      return;
    }
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("materials_catalog")
      .insert({
        business_id: req.businessId!,
        name: name.trim(),
        unit: unit.trim(),
        price: price === undefined || price === null || price === "" ? null : Number(price),
        category: category?.trim() || null,
        supplier: supplier?.trim() || null,
      })
      .select("id")
      .single();
    if (error) throw error;
    res.status(201).json({ id: data.id });
  })
);

apiRouter.patch(
  "/materials/:id",
  route(async (req, res) => {
    const body = req.body ?? {};
    const update: Record<string, unknown> = {};
    if (body.name !== undefined) update.name = String(body.name).trim();
    if (body.unit !== undefined) update.unit = String(body.unit).trim();
    if (body.price !== undefined) update.price = body.price === "" ? null : Number(body.price);
    if (body.category !== undefined) update.category = body.category || null;
    if (body.supplier !== undefined) update.supplier = body.supplier || null;
    if (Object.keys(update).length === 0) {
      res.json({ ok: true });
      return;
    }
    const supabase = req.supabase!;
    const { error } = await supabase
      .from("materials_catalog")
      .update(update)
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  })
);

apiRouter.delete(
  "/materials/:id",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { error } = await supabase
      .from("materials_catalog")
      .delete()
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  })
);

apiRouter.post(
  "/labor-rates",
  route(async (req, res) => {
    const { name, hourlyRate } = req.body ?? {};
    if (!name?.trim() || hourlyRate === undefined || hourlyRate === null || hourlyRate === "") {
      res.status(400).json({ error: "name and hourlyRate are required" });
      return;
    }
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("labor_rates")
      .insert({ business_id: req.businessId!, name: name.trim(), hourly_rate: Number(hourlyRate) })
      .select("id")
      .single();
    if (error) throw error;
    res.status(201).json({ id: data.id });
  })
);

apiRouter.patch(
  "/labor-rates/:id",
  route(async (req, res) => {
    const body = req.body ?? {};
    const update: Record<string, unknown> = {};
    if (body.name !== undefined) update.name = String(body.name).trim();
    if (body.hourlyRate !== undefined) update.hourly_rate = Number(body.hourlyRate);
    const supabase = req.supabase!;
    const { error } = await supabase
      .from("labor_rates")
      .update(update)
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  })
);

apiRouter.delete(
  "/labor-rates/:id",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { error } = await supabase
      .from("labor_rates")
      .delete()
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  })
);

// ---------- Expenses ----------
// Cost Tracking compares budgeted against real spend, so without a way to
// record spend the whole screen is decorative.

apiRouter.get(
  "/expenses",
  route(async (req, res) => {
    const supabase = req.supabase!;
    let query = supabase
      .from("expenses")
      .select("id, project_id, category, description, amount, date, projects(name)")
      .eq("business_id", req.businessId!)
      .order("date", { ascending: false });
    if (req.query.projectId) query = query.eq("project_id", req.query.projectId as string);
    const { data, error } = await query;
    if (error) throw error;
    res.json(
      data.map((e: any) => ({
        id: e.id,
        projectId: e.project_id,
        projectName: e.projects?.name ?? null,
        category: e.category,
        description: e.description,
        amount: Number(e.amount),
        date: e.date,
      }))
    );
  })
);

apiRouter.post(
  "/expenses",
  route(async (req, res) => {
    const { projectId, category, description, amount, date } = req.body ?? {};
    if (!projectId || amount === undefined || Number(amount) <= 0) {
      res.status(400).json({ error: "projectId and a positive amount are required" });
      return;
    }
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        business_id: req.businessId!,
        project_id: projectId,
        category: category?.trim() || null,
        description: description?.trim() || null,
        amount: Number(amount),
        date: date || new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();
    if (error) throw error;
    res.status(201).json({ id: data.id });
  })
);

apiRouter.delete(
  "/expenses/:id",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  })
);

// ---------- Lifecycle updates that were previously read-only ----------

apiRouter.patch(
  "/projects/:id",
  route(async (req, res) => {
    const body = req.body ?? {};
    const update: Record<string, unknown> = {};
    if (body.name !== undefined) update.name = String(body.name).trim();
    if (body.type !== undefined) update.type = body.type || null;
    if (body.startDate !== undefined) update.start_date = body.startDate || null;
    if (body.endDate !== undefined) update.end_date = body.endDate || null;
    if (body.status !== undefined) {
      if (!PROJECT_STATUSES.includes(body.status)) {
        res.status(400).json({ error: "invalid status" });
        return;
      }
      // Goes through the lifecycle so the change is recorded with who made it,
      // instead of the column quietly changing value with no trace.
      const admin = getSupabaseAdmin();
      await setProjectStatus(admin, {
        businessId: req.businessId!,
        projectId: req.params.id,
        status: body.status,
        actor: "admin",
      });
      // A hand-set status bills the same stages an automatic one would: a
      // contractor who marks a job finished expects its invoice either way,
      // and having it depend on how the status got there is the kind of
      // inconsistency that makes people stop trusting the numbers.
      const trigger = TRIGGER_FOR_STATUS[body.status];
      if (trigger) {
        await billMilestonesForTrigger(admin, {
          businessId: req.businessId!,
          projectId: req.params.id,
          trigger,
          createInvoice: (args) =>
            createInvoiceRecord(admin, {
              businessId: args.businessId,
              clientId: args.clientId,
              projectId: args.projectId,
              estimateId: args.estimateId,
              type: args.type,
              subtotal: args.subtotal,
              description: args.description,
            }),
        });
      }
    }
    if (body.progressPercent !== undefined) {
      const pct = Number(body.progressPercent);
      if (Number.isNaN(pct) || pct < 0 || pct > 100) {
        res.status(400).json({ error: "progressPercent must be between 0 and 100" });
        return;
      }
      update.progress_percent = pct;
    }
    // The status went through setProjectStatus above, so a status-only edit
    // leaves nothing here — and PostgREST rejects an empty update.
    if (Object.keys(update).length === 0) {
      res.json({ ok: true });
      return;
    }
    const supabase = req.supabase!;
    const { error } = await supabase
      .from("projects")
      .update(update)
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  })
);

apiRouter.patch(
  "/work-orders/:id",
  route(async (req, res) => {
    const body = req.body ?? {};
    const update: Record<string, unknown> = {};
    if (body.status !== undefined) {
      if (!["pendiente", "en_progreso", "completada"].includes(body.status)) {
        res.status(400).json({ error: "invalid status" });
        return;
      }
      update.status = body.status;
    }
    if (body.priority !== undefined) {
      if (!["baja", "media", "alta"].includes(body.priority)) {
        res.status(400).json({ error: "invalid priority" });
        return;
      }
      update.priority = body.priority;
    }
    if (body.title !== undefined) update.title = String(body.title).trim();
    if (body.description !== undefined) update.description = body.description || null;
    const supabase = req.supabase!;
    const { data: updated, error } = await supabase
      .from("work_orders")
      .update(update)
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id)
      .select("project_id")
      .maybeSingle();
    if (error) throw error;

    // Work orders are how the office tracks what is left, so they are what
    // says the job is running and what says it is done. Closing the last open
    // one is checked here rather than counted once, because orders get added
    // mid-job and "all complete" is only ever true of the current list.
    if (body.status !== undefined && updated?.project_id) {
      const admin = getSupabaseAdmin();
      if (body.status === "en_progreso") {
        await advanceAndBill(admin, {
          businessId: req.businessId!,
          projectId: updated.project_id,
          trigger: "orden_iniciada",
          actor: "admin",
        });
      } else if (body.status === "completada") {
        const allDone = await checkWorkOrdersComplete(admin, req.businessId!, updated.project_id);
        if (allDone) {
          await advanceAndBill(admin, {
            businessId: req.businessId!,
            projectId: updated.project_id,
            trigger: "ordenes_completadas",
            actor: "admin",
          });
        }
      }
    }

    res.json({ ok: true });
  })
);

apiRouter.patch(
  "/clients/:id",
  route(async (req, res) => {
    const body = req.body ?? {};
    const update: Record<string, unknown> = {};
    if (body.name !== undefined) update.name = String(body.name).trim();
    if (body.phone !== undefined) update.phone = body.phone || null;
    if (body.email !== undefined) update.email = body.email || null;
    if (body.address !== undefined) update.address = body.address || null;
    if (body.leadStatus !== undefined) {
      if (!["nuevo", "cotizado", "negociando", "ganado", "perdido"].includes(body.leadStatus)) {
        res.status(400).json({ error: "invalid leadStatus" });
        return;
      }
      update.lead_status = body.leadStatus;
    }
    const supabase = req.supabase!;
    const { error } = await supabase
      .from("clients")
      .update(update)
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  })
);

// ---------- Settings that could be read but never saved ----------

apiRouter.patch(
  "/settings/margins",
  route(async (req, res) => {
    const body = req.body ?? {};
    const update: Record<string, unknown> = {};
    if (body.defaultMarginType !== undefined) {
      if (!["global", "section"].includes(body.defaultMarginType)) {
        res.status(400).json({ error: "defaultMarginType must be global or section" });
        return;
      }
      update.default_margin_type = body.defaultMarginType;
    }
    if (body.defaultWastePercent !== undefined) update.default_waste_percent = Number(body.defaultWastePercent);
    const supabase = req.supabase!;
    const { error } = await supabase
      .from("business_settings")
      .update(update)
      .eq("business_id", req.businessId!);
    if (error) throw error;
    res.json({ ok: true });
  })
);

// Adds a teammate to the business. No Supabase Auth account is created here:
// they claim it themselves by signing up with this email, which links to the
// row by email — the same reason nothing in this product depends on an
// invitation email being delivered.
apiRouter.post(
  "/settings/users",
  route(async (req, res) => {
    const { name, email, phone, roleId } = req.body ?? {};
    if (!name?.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("users")
      .insert({
        business_id: req.businessId!,
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        role_id: roleId || null,
        status: "activo",
      })
      .select("id")
      .single();
    if (error) throw error;
    res.status(201).json({ id: data.id });
  })
);

apiRouter.patch(
  "/settings/users/:id",
  route(async (req, res) => {
    const body = req.body ?? {};
    const update: Record<string, unknown> = {};
    if (body.name !== undefined) update.name = String(body.name).trim();
    if (body.email !== undefined) update.email = body.email || null;
    if (body.phone !== undefined) update.phone = body.phone || null;
    if (body.roleId !== undefined) update.role_id = body.roleId || null;
    if (body.status !== undefined) update.status = body.status;
    const supabase = req.supabase!;
    const { error } = await supabase
      .from("users")
      .update(update)
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  })
);

// ---------- Printable documents (estimate / invoice PDFs) ----------
// The estimate and the invoice are the two artefacts a construction business
// actually hands to a customer, so both are generated as real PDF bytes.
// Both routes stream the same helper: the estimate prices from its own
// client-visible lines, the invoice from the amounts already computed and
// stored when it was issued.

// Fetched here rather than passed as a URL because pdfkit needs the bytes,
// and a document that fails to render because an image host was slow is
// worse than one printed without its logo.
async function fetchLogo(url: string | null | undefined): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function loadBusinessIdentity(
  admin: ReturnType<typeof getSupabaseAdmin>,
  businessId: string
): Promise<{
  identity: BusinessIdentity;
  holdbackPercent: number;
  terms: string | null;
  showMaterials: boolean;
  showSchedule: boolean;
}> {
  const { data, error } = await admin
    .from("businesses")
    .select("name, address, phone, email, license_number, gst_number, qst_number, province, holdback_percent, estimate_terms, logo_url, estimate_show_materials, estimate_show_schedule")
    .eq("id", businessId)
    .single();
  if (error) throw error;
  return {
    identity: {
      name: data.name,
      address: data.address ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      licenseNumber: data.license_number ?? null,
      gstNumber: data.gst_number ?? null,
      qstNumber: data.qst_number ?? null,
      province: data.province ?? null,
      logo: await fetchLogo(data.logo_url),
    },
    holdbackPercent: Number(data.holdback_percent ?? 0),
    terms: data.estimate_terms ?? null,
    showMaterials: data.estimate_show_materials !== false,
    showSchedule: data.estimate_show_schedule !== false,
  };
}

function sendPdf(res: express.Response, pdf: Buffer, filename: string, disposition: "inline" | "attachment") {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);
  res.setHeader("Content-Length", String(pdf.length));
  res.end(pdf);
}

// Shared by the business panel and (via the client portal) the customer, so
// it takes the ids rather than reading them off the request.
async function buildEstimatePdf(businessId: string, estimateId: string, lang: DocLang): Promise<Buffer | null> {
  const admin = getSupabaseAdmin();

  const [estimate, lines, business, projection] = await Promise.all([
    admin
      .from("estimates")
      .select(
        // The embed names its foreign key explicitly because there are two
        // between these tables — estimates.project_id and
        // projects.estimate_id — and PostgREST refuses to guess which one
        // a bare `projects(name)` means.
        "id, status, margin_percent, waste_percent, description, created_at, clients(name, address, phone, email), projects!estimates_project_id_fkey(name)"
      )
      .eq("business_id", businessId)
      .eq("id", estimateId)
      .maybeSingle(),
    admin
      .from("estimate_lines")
      .select("zone, category, item_name, quantity, unit_cost, total, visible_to_client")
      .eq("business_id", businessId)
      .eq("estimate_id", estimateId)
      .order("zone"),
    loadBusinessIdentity(admin, businessId),
    admin
      .from("estimate_projection_items")
      .select("title, zone, planned_start, duration_minutes, employees:assigned_employee_id(name), subcontractors:assigned_subcontractor_id(name)")
      .eq("business_id", businessId)
      .eq("estimate_id", estimateId)
      .order("planned_start"),
  ]);

  if (estimate.error) throw estimate.error;
  if (lines.error) throw lines.error;
  if (!estimate.data) return null;

  // Only lines the business chose to show reach the customer's copy — the
  // internal cost breakdown behind a price is not the customer's business.
  const visible = lines.data.filter((l) => l.visible_to_client);
  const marginPercent = Number(estimate.data.margin_percent ?? 0);
  const wastePercent = Number(estimate.data.waste_percent ?? 0);

  // Waste and margin are the contractor's own arithmetic, not line items the
  // customer should be asked to read, so they are folded into each unit price
  // instead of being printed as extra rows.
  const uplift = (1 + wastePercent / 100) * (1 + marginPercent / 100);
  const docLines: DocLine[] = visible.map((l) => {
    const total = Math.round(Number(l.total) * uplift * 100) / 100;
    const quantity = Number(l.quantity);
    return {
      zone: l.zone,
      item: l.item_name,
      quantity,
      unitCost: quantity ? Math.round((total / quantity) * 100) / 100 : total,
      total,
    };
  });

  const subtotal = Math.round(docLines.reduce((sum, l) => sum + l.total, 0) * 100) / 100;
  const { taxAmount, breakdown } = await computeInvoiceTax(admin, businessId, subtotal);

  const client = estimate.data.clients as unknown as
    | { name: string; address: string | null; phone: string | null; email: string | null }
    | null;
  // A signed estimate is an agreement to the whole payment schedule, not just
  // to the first cheque, so the stages are priced here and printed on it.
  const plan = await readPlan(admin, businessId);

  // The most recent signature, if any. A revised estimate can be signed again
  // and the document should show what was last agreed.
  const { data: signature } = await admin
    .from("estimate_signatures")
    .select("signed_name, signature_image, signed_total, signed_at")
    .eq("estimate_id", estimateId)
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const createdAt = new Date(estimate.data.created_at);
  // A construction estimate that never expires is a price the contractor is
  // stuck with when material costs move, so every one carries 30 days.
  const validUntil = new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);

  return renderEstimatePdf(
    {
      kind: "estimate",
      number: documentNumber("estimate", estimate.data.id),
      date: createdAt,
      validUntil,
      business: business.identity,
      client: {
        name: client?.name ?? "—",
        address: client?.address ?? null,
        phone: client?.phone ?? null,
        email: client?.email ?? null,
      },
      projectName: (estimate.data.projects as any)?.name ?? null,
      description: estimate.data.description ?? null,
      lines: docLines,
      subtotal,
      taxAmount,
      taxBreakdown: breakdown,
      total: Math.round((subtotal + taxAmount) * 100) / 100,
      holdbackPercent: business.holdbackPercent,
      terms: business.terms,
      // Materials come from the estimate's own visible lines, so the list
      // can never claim something the price does not include.
      materials: business.showMaterials
        ? visible
            .filter((l) => l.category === "Materiales")
            .map((l) => ({ name: l.item_name, quantity: Number(l.quantity), unit: null }))
        : [],
      schedule:
        business.showSchedule && !projection.error
          ? (projection.data as any[]).map((item) => ({
              title: item.title,
              zone: item.zone,
              start: new Date(item.planned_start),
              durationMinutes: Number(item.duration_minutes),
              worker: item.employees?.name ?? item.subcontractors?.name ?? null,
            }))
          : [],
      // Against the tax-inclusive total, because that is the figure the
      // customer will actually be asked to pay at each stage.
      payments: splitIntoStages(Math.round((subtotal + taxAmount) * 100) / 100, plan),
      signature: signature
        ? {
            name: signature.signed_name,
            signedAt: new Date(signature.signed_at),
            image: signature.signature_image,
            total: Number(signature.signed_total),
          }
        : null,
    },
    lang
  );
}

/**
 * Splits a total across the payment stages so the column adds up to it exactly.
 *
 * Rounding each stage on its own leaves the last cent unaccounted for — three
 * thirds of $100 come to $99.99 — and a customer who adds up the schedule on a
 * document they are about to sign will find it. The last stage takes whatever
 * is left instead of its own rounded percentage.
 */
function splitIntoStages(
  total: number,
  plan: { label: string; percent: number }[]
): { label: string; percent: number; amount: number }[] {
  const totalCents = Math.round(total * 100);
  let assigned = 0;
  return plan.map((stage, index) => {
    const isLast = index === plan.length - 1;
    const cents = isLast ? totalCents - assigned : Math.round(totalCents * (stage.percent / 100));
    assigned += cents;
    return { label: stage.label, percent: stage.percent, amount: cents / 100 };
  });
}

async function buildPayrollPdf(businessId: string, runId: string, lang: DocLang): Promise<Buffer | null> {
  const admin = getSupabaseAdmin();
  const [run, business] = await Promise.all([
    admin
      .from("payroll_runs")
      .select("*")
      .eq("business_id", businessId)
      .eq("id", runId)
      .maybeSingle(),
    loadBusinessIdentity(admin, businessId),
  ]);
  if (run.error) throw run.error;
  if (!run.data) return null;

  // Rendered from the stored lines, never recomputed: the whole point of
  // recording a run is that it says what it said on the day it was issued.
  return renderPayrollPdf(
    {
      kind: "payroll",
      number: documentNumber("payroll", run.data.id),
      date: new Date(run.data.created_at),
      business: business.identity,
      workerName: run.data.worker_name,
      periodStart: new Date(run.data.period_start),
      periodEnd: new Date(run.data.period_end),
      hours: Number(run.data.hours),
      hourlyRate: Number(run.data.hourly_rate),
      gross: Number(run.data.gross),
      lines: ((run.data.lines ?? []) as Array<Record<string, unknown>>).map((l) => ({
        label: String(l.label),
        paidBy: l.paidBy === "empleador" ? "empleador" : "empleado",
        ratePercent: Number(l.ratePercent),
        amount: Number(l.amount),
      })),
      employeeDeductions: Number(run.data.employee_deductions),
      employerContributions: Number(run.data.employer_contributions),
      net: Number(run.data.net),
      totalCost: Number(run.data.total_cost),
    },
    lang
  );
}

async function buildInvoicePdf(businessId: string, invoiceId: string, lang: DocLang): Promise<Buffer | null> {
  const admin = getSupabaseAdmin();

  const [invoice, business] = await Promise.all([
    admin
      .from("invoices")
      .select("id, type, amount, subtotal, tax_amount, tax_breakdown, holdback_amount, holdback_released, description, due_date, paid_at, created_at, clients(name, address, phone, email), projects(name)")
      .eq("business_id", businessId)
      .eq("id", invoiceId)
      .maybeSingle(),
    loadBusinessIdentity(admin, businessId),
  ]);

  if (invoice.error) throw invoice.error;
  if (!invoice.data) return null;

  const client = invoice.data.clients as unknown as
    | { name: string; address: string | null; phone: string | null; email: string | null }
    | null;

  // Invoices issued before the tax columns existed only carry `amount`; that
  // figure is the amount actually charged, so it stands in as the total and
  // the document simply shows no tax line rather than inventing one.
  const subtotal = Number(invoice.data.subtotal ?? invoice.data.amount ?? 0);
  const taxAmount = Number(invoice.data.tax_amount ?? 0);
  const label = INVOICE_TYPE_LABEL[invoice.data.type] ?? invoice.data.type;

  return renderInvoicePdf(
    {
      kind: "invoice",
      number: documentNumber("invoice", invoice.data.id),
      date: new Date(invoice.data.created_at),
      dueDate: invoice.data.due_date ? new Date(`${invoice.data.due_date}T00:00:00`) : null,
      paidAt: invoice.data.paid_at ? new Date(invoice.data.paid_at) : null,
      business: business.identity,
      client: {
        name: client?.name ?? "—",
        address: client?.address ?? null,
        phone: client?.phone ?? null,
        email: client?.email ?? null,
      },
      projectName: (invoice.data.projects as any)?.name ?? null,
      // The description IS the single line item on an invoice, so printing it
      // again above the table would just say the same thing twice.
      description: null,
      lines: [
        {
          zone: null,
          item: invoice.data.description || label,
          quantity: 1,
          unitCost: subtotal,
          total: subtotal,
        },
      ],
      subtotal,
      taxAmount,
      taxBreakdown: (invoice.data.tax_breakdown as TaxBreakdown) ?? {},
      holdbackAmount: Number(invoice.data.holdback_amount ?? 0),
      holdbackReleased: Number(invoice.data.holdback_released ?? 0),
      total:
        Math.round(
          (subtotal + taxAmount - Number(invoice.data.holdback_amount ?? 0) + Number(invoice.data.holdback_released ?? 0)) * 100
        ) / 100,
    },
    lang
  );
}

apiRouter.get(
  "/estimates/:id/pdf",
  route(async (req, res) => {
    const lang = normalizeDocLang(req.query.lang);
    const pdf = await buildEstimatePdf(req.businessId!, req.params.id, lang);
    if (!pdf) {
      res.status(404).json({ error: "estimate not found" });
      return;
    }
    sendPdf(res, pdf, `${documentNumber("estimate", req.params.id)}.pdf`, req.query.download ? "attachment" : "inline");
  })
);

apiRouter.get(
  "/invoices/:id/pdf",
  route(async (req, res) => {
    const lang = normalizeDocLang(req.query.lang);
    const pdf = await buildInvoicePdf(req.businessId!, req.params.id, lang);
    if (!pdf) {
      res.status(404).json({ error: "invoice not found" });
      return;
    }
    sendPdf(res, pdf, `${documentNumber("invoice", req.params.id)}.pdf`, req.query.download ? "attachment" : "inline");
  })
);

// ---------- Change orders ----------
// A change order is the amendment that keeps an accepted estimate honest
// when the customer asks for something extra mid-job. Approved ones count
// toward the project's budget, which is why /projects/:id folds them in.

const CHANGE_ORDER_STATUSES = ["borrador", "enviado", "aprobado", "rechazado"];

apiRouter.get(
  "/change-orders",
  route(async (req, res) => {
    const supabase = req.supabase!;
    let query = supabase
      .from("change_orders")
      .select("id, project_id, estimate_id, title, description, amount, status, created_at, sent_at, decided_at, projects(name)")
      .eq("business_id", req.businessId!)
      .order("created_at", { ascending: false });
    if (req.query.projectId) query = query.eq("project_id", req.query.projectId as string);
    const { data, error } = await query;
    if (error) throw error;
    res.json(
      data.map((c: any) => ({
        id: c.id,
        projectId: c.project_id,
        projectName: c.projects?.name ?? null,
        estimateId: c.estimate_id,
        title: c.title,
        description: c.description,
        amount: Number(c.amount),
        status: c.status,
        createdAt: c.created_at,
        sentAt: c.sent_at,
        decidedAt: c.decided_at,
      }))
    );
  })
);

apiRouter.post(
  "/change-orders",
  route(async (req, res) => {
    const { projectId, estimateId, title, description, amount } = req.body ?? {};
    if (!title?.trim()) {
      res.status(400).json({ error: "title is required" });
      return;
    }
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("change_orders")
      .insert({
        business_id: req.businessId!,
        project_id: projectId || null,
        estimate_id: estimateId || null,
        title: title.trim(),
        description: description?.trim() || null,
        // A negative amount is a credit — work taken out of scope — so the
        // value is deliberately not clamped to zero.
        amount: Number(amount ?? 0),
      })
      .select("id")
      .single();
    if (error) throw error;
    res.status(201).json({ id: data.id });
  })
);

apiRouter.patch(
  "/change-orders/:id",
  route(async (req, res) => {
    const body = req.body ?? {};
    const update: Record<string, unknown> = {};
    if (body.title !== undefined) update.title = String(body.title).trim();
    if (body.description !== undefined) update.description = body.description || null;
    if (body.amount !== undefined) update.amount = Number(body.amount);
    if (body.status !== undefined) {
      if (!CHANGE_ORDER_STATUSES.includes(body.status)) {
        res.status(400).json({ error: "invalid status" });
        return;
      }
      update.status = body.status;
      // The timestamps are derived from the transition rather than trusted
      // from the client, so the audit trail can't be back-dated.
      if (body.status === "enviado") update.sent_at = new Date().toISOString();
      if (body.status === "aprobado" || body.status === "rechazado") {
        update.decided_at = new Date().toISOString();
      }
    }
    const supabase = req.supabase!;
    const { error } = await supabase
      .from("change_orders")
      .update(update)
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  })
);

apiRouter.delete(
  "/change-orders/:id",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { error } = await supabase
      .from("change_orders")
      .delete()
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  })
);

// The bell in the header. Everything here is something a person has to act
// on, derived from live rows rather than a notifications table: a stored
// feed would need writing at every mutation site and would drift out of
// sync the first time one was missed.
apiRouter.get(
  "/notifications",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const today = new Date().toISOString().slice(0, 10);

    const [estimates, invoices, appointments, changeOrders] = await Promise.all([
      supabase
        .from("estimates")
        .select("id, created_at, clients(name)")
        .eq("business_id", req.businessId!)
        .eq("status", "pendiente_aprobacion")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("invoices")
        .select("id, amount, due_date, clients(name)")
        .eq("business_id", req.businessId!)
        .eq("status", "pendiente")
        .not("due_date", "is", null)
        .lt("due_date", today)
        .order("due_date")
        .limit(10),
      supabase
        .from("appointment_requests")
        .select("id, requested_datetime_text, created_at")
        .eq("business_id", req.businessId!)
        .eq("status", "pendiente")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("change_orders")
        .select("id, title, amount, created_at, projects(name)")
        .eq("business_id", req.businessId!)
        .eq("status", "enviado")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    if (estimates.error) throw estimates.error;
    if (invoices.error) throw invoices.error;
    if (changeOrders.error) throw changeOrders.error;
    // Appointment requests came later than the rest; a deployment without the
    // table should still get a working bell rather than a 500.
    const appointmentRows = appointments.error ? [] : appointments.data;

    const items = [
      ...estimates.data.map((e: any) => ({
        id: `estimate-${e.id}`,
        kind: "estimateToApprove" as const,
        href: "/budgets",
        name: e.clients?.name ?? null,
        amount: null as number | null,
        at: e.created_at,
      })),
      ...invoices.data.map((i: any) => ({
        id: `invoice-${i.id}`,
        kind: "invoiceOverdue" as const,
        href: "/invoicing",
        name: i.clients?.name ?? null,
        amount: Number(i.amount),
        at: i.due_date,
      })),
      ...appointmentRows.map((a: any) => ({
        id: `appointment-${a.id}`,
        kind: "appointmentRequest" as const,
        href: "/communication",
        // The visitor typed when they'd like to come in free text, so it is
        // the name to show — there is no parsed date to format.
        name: a.requested_datetime_text ?? null,
        amount: null,
        at: a.created_at,
      })),
      ...changeOrders.data.map((c: any) => ({
        id: `change-order-${c.id}`,
        kind: "changeOrderAwaiting" as const,
        href: "/projects",
        name: c.projects?.name ?? c.title,
        amount: Number(c.amount),
        at: c.created_at,
      })),
    ].sort((a, b) => String(b.at ?? "").localeCompare(String(a.at ?? "")));

    res.json({ count: items.length, items: items.slice(0, 20) });
  })
);

// ---------- Lifecycle operations that were missing ----------
// A calendar you cannot correct, a file you cannot remove and a phone number
// you cannot fix are not a smaller product — they are a product somebody
// stops trusting the first time reality moves.

apiRouter.patch(
  "/schedule-events/:id",
  route(async (req, res) => {
    const body = req.body ?? {};
    const update: Record<string, unknown> = {};
    if (body.title !== undefined) update.title = String(body.title).trim();
    if (body.type !== undefined) update.type = body.type;
    if (body.notes !== undefined) update.notes = body.notes || null;
    if (body.startTime !== undefined) update.start_time = body.startTime;
    if (body.endTime !== undefined) update.end_time = body.endTime || null;
    // Assignee is set as a pair so moving a job from an employee to a
    // subcontractor clears the other column; the table allows only one.
    if (body.assignedEmployeeId !== undefined || body.assignedSubcontractorId !== undefined) {
      update.assigned_employee_id = body.assignedEmployeeId || null;
      update.assigned_subcontractor_id = body.assignedSubcontractorId || null;
    }
    const supabase = req.supabase!;
    const { error } = await supabase
      .from("schedule_events")
      .update(update)
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  })
);

apiRouter.delete(
  "/schedule-events/:id",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { error } = await supabase
      .from("schedule_events")
      .delete()
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  })
);

apiRouter.delete(
  "/work-orders/:id",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { error } = await supabase
      .from("work_orders")
      .delete()
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  })
);

// Files are deleted from storage first: an orphaned row is a broken link the
// user can retry, while an orphaned object is a file nobody can ever reach
// again and that still counts against the storage bill.
apiRouter.delete(
  "/documents/:id",
  route(async (req, res) => {
    const supabase = req.supabase!;
    // file_url holds the storage path, not a URL — the bucket is private and
    // reads go through a short-lived signed link.
    const { data: doc } = await supabase
      .from("documents")
      .select("id, file_url")
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id)
      .maybeSingle();
    if (!doc) {
      res.status(404).json({ error: "document not found" });
      return;
    }
    if (doc.file_url) {
      await supabase.storage.from("project-documents").remove([doc.file_url]);
    }
    const { error } = await supabase.from("documents").delete().eq("id", doc.id);
    if (error) throw error;
    res.json({ ok: true });
  })
);

apiRouter.delete(
  "/photos/:id",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data: photo } = await supabase
      .from("photos")
      .select("id, url")
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id)
      .maybeSingle();
    if (!photo) {
      res.status(404).json({ error: "photo not found" });
      return;
    }
    if (photo.url) {
      await supabase.storage.from("project-photos").remove([photo.url]);
    }
    const { error } = await supabase.from("photos").delete().eq("id", photo.id);
    if (error) throw error;
    res.json({ ok: true });
  })
);

apiRouter.patch(
  "/photos/:id",
  route(async (req, res) => {
    const body = req.body ?? {};
    const update: Record<string, unknown> = {};
    if (body.zone !== undefined) update.zone = body.zone || null;
    if (body.visibleToClient !== undefined) update.visible_to_client = Boolean(body.visibleToClient);
    const supabase = req.supabase!;
    const { error } = await supabase
      .from("photos")
      .update(update)
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  })
);

apiRouter.patch(
  "/employees/:id",
  route(async (req, res) => {
    const body = req.body ?? {};
    const update: Record<string, unknown> = {};
    if (body.name !== undefined) update.name = String(body.name).trim();
    if (body.phone !== undefined) update.phone = body.phone || null;
    if (body.role !== undefined) update.role = body.role || null;
    if (body.status !== undefined) {
      if (!["disponible", "en_proyecto", "descanso"].includes(body.status)) {
        res.status(400).json({ error: "invalid status" });
        return;
      }
      update.status = body.status;
    }
    // Optional throughout: null means "we don't track what this person costs",
    // which is a legitimate way to run a small crew and is the default.
    if (body.hourlyRate !== undefined) {
      const rate = body.hourlyRate === null || body.hourlyRate === "" ? null : Number(body.hourlyRate);
      if (rate !== null && (!Number.isFinite(rate) || rate < 0)) {
        res.status(400).json({ error: "hourlyRate must be a positive number or null" });
        return;
      }
      update.hourly_rate = rate;
    }
    if (body.payNotes !== undefined) update.pay_notes = body.payNotes || null;
    const supabase = req.supabase!;
    const { error } = await supabase
      .from("employees")
      .update(update)
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  })
);

apiRouter.patch(
  "/subcontractors/:id",
  route(async (req, res) => {
    const body = req.body ?? {};
    const update: Record<string, unknown> = {};
    if (body.name !== undefined) update.name = String(body.name).trim();
    if (body.trade !== undefined) update.trade = body.trade || null;
    if (body.phone !== undefined) update.phone = body.phone || null;
    if (body.rating !== undefined) {
      const rating = Number(body.rating);
      if (Number.isNaN(rating) || rating < 0 || rating > 5) {
        res.status(400).json({ error: "rating must be between 0 and 5" });
        return;
      }
      update.rating = rating;
    }
    if (body.hourlyRate !== undefined) {
      const rate = body.hourlyRate === null || body.hourlyRate === "" ? null : Number(body.hourlyRate);
      if (rate !== null && (!Number.isFinite(rate) || rate < 0)) {
        res.status(400).json({ error: "hourlyRate must be a positive number or null" });
        return;
      }
      update.hourly_rate = rate;
    }
    if (body.payNotes !== undefined) update.pay_notes = body.payNotes || null;
    const supabase = req.supabase!;
    const { error } = await supabase
      .from("subcontractors")
      .update(update)
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  })
);

// An invoice is an accounting record, so it is cancelled rather than deleted —
// and a paid one is not cancellable at all: that money moved, and pretending
// otherwise would put the books and the bank out of agreement.
apiRouter.patch(
  "/invoices/:id/cancel",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data: invoice } = await supabase
      .from("invoices")
      .select("id, status")
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id)
      .maybeSingle();
    if (!invoice) {
      res.status(404).json({ error: "invoice not found" });
      return;
    }
    if (invoice.status === "pagado") {
      res.status(409).json({ error: "a paid invoice cannot be cancelled — issue a credit instead" });
      return;
    }
    const { error } = await supabase.from("invoices").update({ status: "cancelado" }).eq("id", invoice.id);
    if (error) throw error;
    res.json({ ok: true, status: "cancelado" });
  })
);

// ---------- Chat attachments ----------
// Anything the conversation needs to carry: a generated estimate or invoice
// (stored as a reference so the PDF always matches the live row), or an
// uploaded file.

/** Finds the client's internal channel, creating it the first time. */
/**
 * The wire shape of a message, attachment included.
 *
 * Every GET-messages route used to drop the attachment and return only text,
 * so a worker or a customer saw a bare filename-less line where a document had
 * been sent — the estimate the contractor "sent to the client through the
 * chat" was invisible to the client. Only the POST echoed it back, which made
 * it look like it worked right up until the page was reloaded.
 */
function toChatMessage(m: Record<string, any>) {
  return {
    id: m.id,
    senderType: m.sender_type,
    content: m.content,
    timestamp: m.created_at,
    attachment: m.attachment_kind
      ? {
          kind: m.attachment_kind,
          id: m.attachment_id,
          name: m.attachment_name,
          mime: m.attachment_mime,
        }
      : null,
  };
}

/**
 * Adds what an invoice attachment is worth and whether it is still owed, so a
 * conversation can show a pay button instead of a document nobody acts on.
 * Only for the customer's own side; the panel already has an invoicing screen.
 */
async function withInvoiceState(
  admin: ReturnType<typeof getSupabaseAdmin>,
  messages: ReturnType<typeof toChatMessage>[]
) {
  const invoiceIds = Array.from(
    new Set(messages.filter((m) => m.attachment?.kind === "invoice").map((m) => m.attachment!.id as string))
  );
  if (invoiceIds.length === 0) return messages;

  const { data } = await admin.from("invoices").select("id, amount, status").in("id", invoiceIds);
  const byId = new Map((data ?? []).map((i) => [i.id, i]));
  return messages.map((m) => {
    if (m.attachment?.kind !== "invoice") return m;
    const invoice = byId.get(m.attachment.id as string);
    return {
      ...m,
      attachment: {
        ...m.attachment,
        amount: invoice ? Number(invoice.amount) : null,
        status: invoice?.status ?? null,
      },
    };
  });
}

async function ensureClientChannel(
  admin: ReturnType<typeof getSupabaseAdmin>,
  businessId: string,
  clientId: string
): Promise<string> {
  const { data: existing } = await admin
    .from("chat_channels")
    .select("id")
    .eq("business_id", businessId)
    .eq("participant_type", "client")
    .eq("participant_id", clientId)
    .eq("system", "interno")
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await admin
    .from("chat_channels")
    .insert({
      business_id: businessId,
      participant_type: "client",
      participant_id: clientId,
      system: "interno",
      status: "activo",
      control_mode: "humano",
    })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

// Sends the estimate to the customer as a document in their own chat. This
// is the moment the estimate stops being an internal draft and becomes an
// offer someone can read, question, or accept.
apiRouter.post(
  "/estimates/:id/send-to-client",
  route(async (req, res) => {
    const admin = getSupabaseAdmin();
    const { data: estimate } = await admin
      .from("estimates")
      .select("id, client_id, status")
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id)
      .maybeSingle();
    if (!estimate) {
      res.status(404).json({ error: "estimate not found" });
      return;
    }
    if (!estimate.client_id) {
      res.status(409).json({ error: "this estimate has no client to send it to" });
      return;
    }

    // Sending it IS sending it: an estimate the customer can read but that
    // still says "draft" internally would let them accept something the
    // contractor never released.
    if (estimate.status === "borrador" || estimate.status === "pendiente_aprobacion") {
      const { error: statusError } = await admin
        .from("estimates")
        .update({ status: "enviado" })
        .eq("id", estimate.id);
      if (statusError) throw statusError;
    }

    const channelId = await ensureClientChannel(admin, req.businessId!, estimate.client_id);
    const { data: channel } = await admin
      .from("chat_channels")
      .select("disappearing_duration")
      .eq("id", channelId)
      .single();

    const { data: message, error } = await admin
      .from("chat_messages")
      .insert({
        channel_id: channelId,
        business_id: req.businessId!,
        sender_type: "admin",
        sender_id: req.authUserId ?? null,
        content: String(req.body?.message ?? "").trim() || documentNumber("estimate", estimate.id),
        attachment_kind: "estimate",
        attachment_id: estimate.id,
        attachment_name: `${documentNumber("estimate", estimate.id)}.pdf`,
        attachment_mime: "application/pdf",
        expires_at: computeExpiresAt(channel?.disappearing_duration ?? null),
      })
      .select("id")
      .single();
    if (error) throw error;

    res.status(201).json({ id: message.id, channelId, status: "enviado" });
  })
);

apiRouter.post(
  "/chat/channels/:id/attachments",
  upload.single("file"),
  route(async (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "file is required" });
      return;
    }
    const supabase = req.supabase!;
    const { data: channel, error: channelError } = await supabase
      .from("chat_channels")
      .select("id, disappearing_duration")
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id)
      .single();
    if (channelError) throw channelError;

    const storagePath = `${req.businessId}/${channel.id}/${randomUUID()}-${file.originalname}`;
    const { error: uploadError } = await supabase.storage
      .from("chat-attachments")
      .upload(storagePath, file.buffer, { contentType: file.mimetype });
    if (uploadError) throw uploadError;

    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        channel_id: channel.id,
        business_id: req.businessId!,
        sender_type: "admin",
        sender_id: req.authUserId ?? null,
        content: String(req.body?.content ?? "").trim() || file.originalname,
        attachment_kind: file.mimetype.startsWith("image/") ? "image" : "file",
        attachment_path: storagePath,
        attachment_name: file.originalname,
        attachment_mime: file.mimetype,
        expires_at: computeExpiresAt(channel.disappearing_duration),
      })
      .select("id, sender_type, sender_id, content, created_at, attachment_kind, attachment_id, attachment_name, attachment_mime")
      .single();
    if (error) throw error;

    res.status(201).json({
      id: data.id,
      senderType: data.sender_type,
      content: data.content,
      timestamp: data.created_at,
      attachment: { kind: data.attachment_kind, id: data.attachment_id, name: data.attachment_name, mime: data.attachment_mime },
    });
  })
);

/**
 * Resolves a message attachment to something openable. Shared by the panel,
 * the client portal and the field app, so the ownership check is passed in
 * rather than assumed: each caller knows how it is allowed to see a channel.
 */
async function resolveAttachment(
  admin: ReturnType<typeof getSupabaseAdmin>,
  messageId: string,
  canSee: (message: { business_id: string; channel_id: string }) => Promise<boolean>
): Promise<{ status: number; body: Record<string, unknown> }> {
  const { data: message } = await admin
    .from("chat_messages")
    .select("id, business_id, channel_id, attachment_kind, attachment_id, attachment_path, attachment_name")
    .eq("id", messageId)
    .maybeSingle();
  if (!message?.attachment_kind || !(await canSee(message))) {
    return { status: 404, body: { error: "attachment not found" } };
  }

  if (message.attachment_kind === "estimate" || message.attachment_kind === "invoice") {
    // Generated on demand from the live row, so the document a customer opens
    // months later is the document the system actually holds.
    return {
      status: 200,
      body: { kind: message.attachment_kind, documentId: message.attachment_id, name: message.attachment_name },
    };
  }

  const { data: signed, error } = await admin.storage
    .from("chat-attachments")
    .createSignedUrl(message.attachment_path!, 300);
  if (error) throw error;
  return { status: 200, body: { kind: message.attachment_kind, url: signed.signedUrl, name: message.attachment_name } };
}

apiRouter.get(
  "/chat/messages/:id/attachment",
  route(async (req, res) => {
    const admin = getSupabaseAdmin();
    const result = await resolveAttachment(admin, req.params.id, async (m) => m.business_id === req.businessId);
    res.status(result.status).json(result.body);
  })
);

// ---------- Reports & Analytics ----------
// The month-by-month revenue/expense series is grouped from real payment
// and expense dates (not a stored aggregate, and not a fabricated series
// like the Fase A mock's hardcoded 6 months).
apiRouter.get(
  "/reports",
  route(async (req, res) => {
    const supabase = req.supabase!;

    const [payments, expenses, projects, paidInvoices, employees, timeEntries, materialLines] = await Promise.all([
      supabase.from("payments").select("amount, paid_at").eq("business_id", req.businessId!),
      supabase.from("expenses").select("amount, date").eq("business_id", req.businessId!),
      supabase.from("projects").select("status").eq("business_id", req.businessId!),
      // Split by what the money was for. A job over budget and a job that grew
      // are opposite problems with opposite answers, and revenue alone cannot
      // tell them apart.
      supabase
        .from("invoices")
        .select("amount, charge_kind, status")
        .eq("business_id", req.businessId!)
        .eq("status", "pagado"),
      supabase.from("employees").select("id, name").eq("business_id", req.businessId!),
      supabase
        .from("time_entries")
        .select("employee_id, check_in_time, check_out_time")
        .eq("business_id", req.businessId!)
        .not("check_out_time", "is", null),
      // "Materiales más usados" = counted from real estimate_lines references,
      // not a fabricated ranking.
      supabase
        .from("estimate_lines")
        .select("item_name, quantity, materials_catalog(unit)")
        .eq("business_id", req.businessId!)
        .not("material_id", "is", null),
    ]);

    if (payments.error) throw payments.error;
    if (expenses.error) throw expenses.error;
    if (projects.error) throw projects.error;
    if (paidInvoices.error) throw paidInvoices.error;
    if (employees.error) throw employees.error;
    if (timeEntries.error) throw timeEntries.error;
    if (materialLines.error) throw materialLines.error;

    const monthKey = (iso: string) => iso.slice(0, 7); // "YYYY-MM"
    const months = new Set<string>();
    for (const p of payments.data) if (p.paid_at) months.add(monthKey(p.paid_at));
    for (const e of expenses.data) months.add(monthKey(e.date));

    const revenueByMonth = Array.from(months)
      .sort()
      .map((month) => ({
        month,
        ingresos: payments.data
          .filter((p) => p.paid_at && monthKey(p.paid_at) === month)
          .reduce((sum, p) => sum + Number(p.amount), 0),
        gastos: expenses.data
          .filter((e) => monthKey(e.date) === month)
          .reduce((sum, e) => sum + Number(e.amount), 0),
      }));

    const totalRevenue = payments.data.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalExpense = expenses.data.reduce((sum, e) => sum + Number(e.amount), 0);

    const hoursByEmployee = employees.data.map((e) => ({
      name: e.name.split(" ")[0],
      horas: Math.round(
        timeEntries.data
          .filter((t) => t.employee_id === e.id)
          .reduce((sum, t) => sum + (new Date(t.check_out_time!).getTime() - new Date(t.check_in_time).getTime()) / 3600000, 0)
      ),
    }));

    const usageByMaterial = new Map<string, { unit: string; timesUsed: number; totalQuantity: number }>();
    for (const line of materialLines.data as any[]) {
      const key = line.item_name;
      const existing = usageByMaterial.get(key) ?? { unit: line.materials_catalog?.unit ?? "", timesUsed: 0, totalQuantity: 0 };
      existing.timesUsed += 1;
      existing.totalQuantity += Number(line.quantity);
      usageByMaterial.set(key, existing);
    }
    const topMaterials = Array.from(usageByMaterial.entries())
      .sort((a, b) => b[1].timesUsed - a[1].timesUsed)
      .slice(0, 5)
      .map(([name, info]) => ({ name, unit: info.unit, totalQuantity: info.totalQuantity }));

    res.json({
      revenueByMonth,
      totalRevenue,
      totalExpense,
      profit: totalRevenue - totalExpense,
      activeProjects: projects.data.filter((p) => p.status === "en_progreso").length,
      completedProjects: projects.data.filter((p) => p.status === "completado").length,
      // Collected, split by what it was for.
      revenueByChargeKind: {
        proyecto: Math.round(
          paidInvoices.data
            .filter((i) => i.charge_kind !== "extra")
            .reduce((sum, i) => sum + Number(i.amount), 0) * 100
        ) / 100,
        extra: Math.round(
          paidInvoices.data
            .filter((i) => i.charge_kind === "extra")
            .reduce((sum, i) => sum + Number(i.amount), 0) * 100
        ) / 100,
      },
      hoursByEmployee,
      topMaterials,
    });
  })
);

// ---------- Client Portal, as the business previews it ----------
// Despite the prefix this is a BUSINESS route and belongs below the auth
// gate: it is the admin's preview of what one of their clients sees, scoped
// by req.businessId. The client's own version is /client-portal/me, which
// sits above the gate with requireClientAuth. Do not move this one up.

apiRouter.get(
  "/client-portal/:clientId",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const clientId = req.params.clientId;

    const [client, project, estimate, pendingInvoice] = await Promise.all([
      supabase
        .from("clients")
        .select("id, name")
        .eq("business_id", req.businessId!)
        .eq("id", clientId)
        .single(),
      supabase
        .from("projects")
        .select("id, name, progress_percent")
        .eq("business_id", req.businessId!)
        .eq("client_id", clientId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("estimates")
        .select("id, status, total")
        .eq("business_id", req.businessId!)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("invoices")
        .select("id, type, amount, status")
        .eq("business_id", req.businessId!)
        .eq("client_id", clientId)
        .neq("status", "pagado")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (client.error) throw client.error;
    if (project.error) throw project.error;
    if (estimate.error) throw estimate.error;
    if (pendingInvoice.error) throw pendingInvoice.error;

    // What they signed, so the portal can show it back instead of offering to
    // sign something already signed.
    const { data: signature } = estimate.data
      ? await getSupabaseAdmin()
          .from("estimate_signatures")
          .select("signed_name, signed_at, signed_total")
          .eq("estimate_id", estimate.data.id)
          .order("signed_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

    let visiblePhotos: { id: string }[] = [];
    if (project.data) {
      const { data, error } = await supabase
        .from("photos")
        .select("id")
        .eq("business_id", req.businessId!)
        .eq("project_id", project.data.id)
        .eq("visible_to_client", true);
      if (error) throw error;
      visiblePhotos = data;
    }

    res.json({
      client: { id: client.data.id, name: client.data.name },
      project: project.data
        ? { id: project.data.id, name: project.data.name, progressPercent: Number(project.data.progress_percent) }
        : null,
      estimate: estimate.data
        ? {
            id: estimate.data.id,
            status: estimate.data.status,
            total: Number(estimate.data.total),
            signature: signature
              ? { name: signature.signed_name, signedAt: signature.signed_at, total: Number(signature.signed_total) }
              : null,
          }
        : null,
      pendingInvoice: pendingInvoice.data
        ? { id: pendingInvoice.data.id, type: pendingInvoice.data.type, amount: Number(pendingInvoice.data.amount), status: pendingInvoice.data.status }
        : null,
      visiblePhotos,
    });
  })
);

// ---------- Communication ----------

apiRouter.get(
  "/conversations",
  route(async (req, res) => {
    const supabase = req.supabase!;

    const [conversations, messages] = await Promise.all([
      supabase
        .from("conversations")
        .select("id, client_id, control_mode, clients(name, phone)")
        .eq("business_id", req.businessId!),
      supabase
        .from("conversation_messages")
        .select("conversation_id, content, timestamp")
        .eq("business_id", req.businessId!)
        .order("timestamp", { ascending: false }),
    ]);

    if (conversations.error) throw conversations.error;
    if (messages.error) throw messages.error;

    res.json(
      conversations.data.map((c: any) => ({
        id: c.id,
        clientId: c.client_id,
        clientName: c.clients?.name ?? null,
        clientPhone: c.clients?.phone ?? null,
        controlMode: c.control_mode,
        lastMessage: (messages.data as any[]).find((m) => m.conversation_id === c.id)?.content ?? null,
      }))
    );
  })
);

apiRouter.get(
  "/conversations/:id/messages",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("conversation_messages")
      .select("id, direction, content, sent_by, timestamp")
      .eq("business_id", req.businessId!)
      .eq("conversation_id", req.params.id)
      .order("timestamp");

    if (error) throw error;

    res.json(
      data.map((m) => ({
        id: m.id,
        direction: m.direction,
        content: m.content,
        sentBy: m.sent_by,
        timestamp: m.timestamp,
      }))
    );
  })
);

apiRouter.patch(
  "/conversations/:id",
  route(async (req, res) => {
    const controlMode = req.body?.controlMode;
    if (controlMode !== "bot" && controlMode !== "human") {
      res.status(400).json({ error: "controlMode must be 'bot' or 'human'" });
      return;
    }
    const supabase = req.supabase!;
    const { error } = await supabase
      .from("conversations")
      .update({ control_mode: controlMode })
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);

    if (error) throw error;
    res.json({ ok: true });
  })
);

// ---------- Unified chat (chat_channels / chat_messages) ----------
// Replaces/formalizes the client-only Communication above for all
// human<->human threads (admin<->worker, admin<->subcontractor,
// admin<->client). The old conversations/conversation_messages tables and
// routes above are left in place, unused going forward, not dropped.

function labelForParticipantType(participantType: string): string {
  return participantType === "employee" ? "trabajador" : participantType === "subcontractor" ? "subcontrato" : "cliente";
}

apiRouter.get(
  "/chat/channels",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const system = typeof req.query.system === "string" ? req.query.system : undefined;
    const label = typeof req.query.label === "string" ? req.query.label : undefined;

    let query = supabase
      .from("chat_channels")
      .select(
        "id, system, label, participant_type, participant_id, status, control_mode, disappearing_duration, pinned, archived, created_at"
      )
      .eq("business_id", req.businessId!);
    if (system) query = query.eq("system", system);
    if (label) query = query.eq("label", label);

    const { data: channels, error } = await query
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;

    const employeeIds = channels.filter((c) => c.participant_type === "employee").map((c) => c.participant_id);
    const subcontractorIds = channels.filter((c) => c.participant_type === "subcontractor").map((c) => c.participant_id);
    const clientIds = channels.filter((c) => c.participant_type === "client").map((c) => c.participant_id);
    const channelIds = channels.map((c) => c.id);

    const [employees, subcontractors, clients, lastMessages] = await Promise.all([
      employeeIds.length
        ? supabase.from("employees").select("id, name, avatar_url").in("id", employeeIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      subcontractorIds.length
        ? supabase.from("subcontractors").select("id, name, avatar_url").in("id", subcontractorIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      clientIds.length
        ? supabase.from("clients").select("id, name, avatar_url").in("id", clientIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      channelIds.length
        ? supabase
            .from("chat_messages")
            .select("channel_id, content, created_at")
            .in("channel_id", channelIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[], error: null }),
    ]);
    if (employees.error) throw employees.error;
    if (subcontractors.error) throw subcontractors.error;
    if (clients.error) throw clients.error;
    if (lastMessages.error) throw lastMessages.error;

    const participantOf = (c: (typeof channels)[number]) => {
      const pool = c.participant_type === "employee" ? employees.data : c.participant_type === "subcontractor" ? subcontractors.data : clients.data;
      return (pool as any[]).find((p) => p.id === c.participant_id);
    };

    res.json(
      channels.map((c) => {
        const participant = participantOf(c);
        const lastMessage = (lastMessages.data as any[]).find((m) => m.channel_id === c.id);
        return {
          id: c.id,
          system: c.system,
          label: c.label,
          participantType: c.participant_type,
          participantId: c.participant_id,
          participantName: participant?.name ?? null,
          participantAvatarUrl: participant?.avatar_url ?? null,
          status: c.status,
          controlMode: c.control_mode,
          disappearingDuration: c.disappearing_duration,
          pinned: c.pinned,
          archived: c.archived,
          lastMessage: lastMessage?.content ?? null,
          lastMessageAt: lastMessage?.created_at ?? null,
        };
      })
    );
  })
);

// Contacts (employees/subcontractors/clients) with no chat_channel yet — the
// pool "Nueva conversación" picks from. In practice mostly clients added
// manually via CRM, since employees/subcontractors already get one at
// creation and most clients arrive via the public chat.
apiRouter.get(
  "/chat/directory",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const [employees, subcontractors, clients, channels] = await Promise.all([
      supabase.from("employees").select("id, name, avatar_url").eq("business_id", req.businessId!),
      supabase.from("subcontractors").select("id, name, avatar_url").eq("business_id", req.businessId!),
      supabase.from("clients").select("id, name, avatar_url").eq("business_id", req.businessId!),
      supabase.from("chat_channels").select("participant_type, participant_id").eq("business_id", req.businessId!),
    ]);
    if (employees.error) throw employees.error;
    if (subcontractors.error) throw subcontractors.error;
    if (clients.error) throw clients.error;
    if (channels.error) throw channels.error;

    const hasChannel = (participantType: string, id: string) =>
      (channels.data as any[]).some((c) => c.participant_type === participantType && c.participant_id === id);

    res.json([
      ...employees.data
        .filter((e) => !hasChannel("employee", e.id))
        .map((e) => ({ participantType: "employee", participantId: e.id, name: e.name, avatarUrl: e.avatar_url })),
      ...subcontractors.data
        .filter((s) => !hasChannel("subcontractor", s.id))
        .map((s) => ({ participantType: "subcontractor", participantId: s.id, name: s.name, avatarUrl: s.avatar_url })),
      ...clients.data
        .filter((c) => !hasChannel("client", c.id))
        .map((c) => ({ participantType: "client", participantId: c.id, name: c.name, avatarUrl: c.avatar_url })),
    ]);
  })
);

// Only the business panel can start a new channel — workers/clients only
// ever see channels the admin already opened with them.
apiRouter.post(
  "/chat/channels",
  route(async (req, res) => {
    const { participantType, participantId } = req.body ?? {};
    if (!["employee", "subcontractor", "client"].includes(participantType) || !participantId) {
      res.status(400).json({ error: "participantType and participantId are required" });
      return;
    }
    const supabase = req.supabase!;

    const { data: existing } = await supabase
      .from("chat_channels")
      .select("id")
      .eq("business_id", req.businessId!)
      .eq("participant_type", participantType)
      .eq("participant_id", participantId)
      .maybeSingle();
    if (existing) {
      res.json({ id: existing.id });
      return;
    }

    const { data, error } = await supabase
      .from("chat_channels")
      .insert({
        business_id: req.businessId!,
        system: "interno",
        label: labelForParticipantType(participantType),
        participant_type: participantType,
        participant_id: participantId,
        status: participantType === "client" ? "activo" : "invitado",
      })
      .select("id")
      .single();
    if (error) throw error;
    res.status(201).json({ id: data.id });
  })
);

apiRouter.get(
  "/chat/channels/:id/messages",
  route(async (req, res) => {
    const supabase = req.supabase!;
    await purgeExpiredMessages(supabase, req.params.id);
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, sender_type, sender_id, content, created_at, attachment_kind, attachment_id, attachment_name, attachment_mime")
      .eq("business_id", req.businessId!)
      .eq("channel_id", req.params.id)
      .order("created_at");
    if (error) throw error;
    res.json(
      data.map((m) => ({
        id: m.id,
        senderType: m.sender_type,
        senderId: m.sender_id,
        content: m.content,
        timestamp: m.created_at,
        attachment: m.attachment_kind
          ? {
              kind: m.attachment_kind,
              id: m.attachment_id,
              name: m.attachment_name,
              mime: m.attachment_mime,
            }
          : null,
      }))
    );
  })
);

apiRouter.post(
  "/chat/channels/:id/messages",
  route(async (req, res) => {
    const content = String(req.body?.content ?? "").trim();
    if (!content) {
      res.status(400).json({ error: "content is required" });
      return;
    }
    const supabase = req.supabase!;
    const { data: channel, error: channelError } = await supabase
      .from("chat_channels")
      .select("id, disappearing_duration")
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id)
      .single();
    if (channelError) throw channelError;

    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        channel_id: channel.id,
        business_id: req.businessId!,
        sender_type: "admin",
        sender_id: req.authUserId ?? null,
        content,
        expires_at: computeExpiresAt(channel.disappearing_duration),
      })
      .select("id, sender_type, sender_id, content, created_at, attachment_kind, attachment_id, attachment_name, attachment_mime")
      .single();
    if (error) throw error;
    res.status(201).json({
      id: data.id,
      senderType: data.sender_type,
      senderId: data.sender_id,
      content: data.content,
      timestamp: data.created_at,
      attachment: data.attachment_kind
        ? { kind: data.attachment_kind, id: data.attachment_id, name: data.attachment_name, mime: data.attachment_mime }
        : null,
    });
  })
);

apiRouter.patch(
  "/chat/channels/:id",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const body = req.body ?? {};
    const update: Record<string, unknown> = {};
    if (body.pinned !== undefined) update.pinned = !!body.pinned;
    if (body.archived !== undefined) update.archived = !!body.archived;
    if (body.disappearingDuration !== undefined) {
      if (!["24h", "72h", "nunca"].includes(body.disappearingDuration)) {
        res.status(400).json({ error: "disappearingDuration must be 24h, 72h or nunca" });
        return;
      }
      update.disappearing_duration = body.disappearingDuration;
    }
    if (body.controlMode !== undefined) {
      if (body.controlMode !== "bot" && body.controlMode !== "human") {
        res.status(400).json({ error: "controlMode must be 'bot' or 'human'" });
        return;
      }
      update.control_mode = body.controlMode;
    }
    const { error } = await supabase.from("chat_channels").update(update).eq("business_id", req.businessId!).eq("id", req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  })
);

// Bulk delete, capped at 5 — matches the "hold to select, max 5" UI.
apiRouter.post(
  "/chat/channels/bulk-delete",
  route(async (req, res) => {
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (ids.length === 0 || ids.length > 5) {
      res.status(400).json({ error: "Selecciona entre 1 y 5 chats" });
      return;
    }
    const supabase = req.supabase!;
    const { error } = await supabase.from("chat_channels").delete().eq("business_id", req.businessId!).in("id", ids);
    if (error) throw error;
    res.json({ ok: true });
  })
);

// ---------- Configuración ----------

apiRouter.get(
  "/settings/company",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("businesses")
      .select(
        "id, name, slug, license_number, tax_config, province, address, phone, email, gst_number, qst_number, holdback_percent, estimate_terms, logo_url, estimate_show_materials, estimate_show_schedule"
      )
      .eq("id", req.businessId!)
      .single();

    if (error) throw error;

    res.json({
      id: data.id,
      name: data.name,
      slug: data.slug,
      licenseNumber: data.license_number,
      taxConfig: data.tax_config,
      province: data.province,
      // Everything below prints in the header (or the footer) of every
      // estimate and invoice this business sends out.
      address: data.address,
      phone: data.phone,
      email: data.email,
      gstNumber: data.gst_number,
      qstNumber: data.qst_number,
        holdbackPercent: Number(data.holdback_percent ?? 0),
      estimateTerms: data.estimate_terms,
      logoUrl: data.logo_url ?? null,
      estimateShowMaterials: data.estimate_show_materials !== false,
      estimateShowSchedule: data.estimate_show_schedule !== false,
    });
  })
);

// The logo is the first thing on every estimate and invoice, so it is worth
// a real upload rather than a placeholder initial. Stored in a public bucket
// on purpose: the PDF generator reads it back months later, and a signed URL
// that expires would leave an archived document without its own letterhead.
apiRouter.post(
  "/settings/logo",
  upload.single("file"),
  route(async (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "file is required" });
      return;
    }
    if (!/^image\/(png|jpeg|jpg|webp|svg\+xml)$/.test(file.mimetype)) {
      res.status(400).json({ error: "the logo must be a PNG, JPEG, WebP or SVG image" });
      return;
    }

    const admin = getSupabaseAdmin();
    const extension = file.originalname.includes(".") ? file.originalname.split(".").pop() : "png";
    // The path carries a fresh id every time so a replaced logo is never
    // served from a stale cache under the old URL.
    const storagePath = `${req.businessId}/${randomUUID()}.${extension}`;

    const { error: uploadError } = await admin.storage
      .from("business-logos")
      .upload(storagePath, file.buffer, { contentType: file.mimetype, upsert: true });
    if (uploadError) throw uploadError;

    const { data: publicUrl } = admin.storage.from("business-logos").getPublicUrl(storagePath);

    const supabase = req.supabase!;
    const { error } = await supabase
      .from("businesses")
      .update({ logo_url: publicUrl.publicUrl })
      .eq("id", req.businessId!);
    if (error) throw error;

    res.status(201).json({ logoUrl: publicUrl.publicUrl });
  })
);

apiRouter.delete(
  "/settings/logo",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { error } = await supabase
      .from("businesses")
      .update({ logo_url: null })
      .eq("id", req.businessId!);
    if (error) throw error;
    res.json({ ok: true });
  })
);

// The fixed reference list of Canadian provinces/territories + their
// GST/HST/PST/QST rates, for the province picker in Settings > Pagos.
apiRouter.get(
  "/canada-tax-rates",
  route(async (_req, res) => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("canada_tax_rates")
      .select("province, label, is_hst, gst_rate, pst_rate, hst_rate")
      .order("label");
    if (error) throw error;
    res.json(
      data.map((r) => ({
        province: r.province,
        label: r.label,
        isHst: r.is_hst,
        gstRate: Number(r.gst_rate),
        pstRate: Number(r.pst_rate),
        hstRate: Number(r.hst_rate),
      }))
    );
  })
);

// Where a brand-new business fills in everything registration deliberately
// didn't ask for (name, license, tax region/rate) — registration only ever
// collects email/phone + password.
apiRouter.patch(
  "/settings/company",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const body = req.body ?? {};
    const update: Record<string, unknown> = {};
    if (body.name !== undefined) update.name = body.name;
    if (body.licenseNumber !== undefined) update.license_number = body.licenseNumber;
    if (body.taxConfig !== undefined) update.tax_config = body.taxConfig;
    if (body.province !== undefined) update.province = body.province;
    if (body.address !== undefined) update.address = body.address || null;
    if (body.phone !== undefined) update.phone = body.phone || null;
    if (body.email !== undefined) update.email = body.email || null;
    if (body.gstNumber !== undefined) update.gst_number = body.gstNumber || null;
    if (body.qstNumber !== undefined) update.qst_number = body.qstNumber || null;
    if (body.estimateTerms !== undefined) update.estimate_terms = body.estimateTerms || null;
    if (body.estimateShowMaterials !== undefined) update.estimate_show_materials = Boolean(body.estimateShowMaterials);
    if (body.estimateShowSchedule !== undefined) update.estimate_show_schedule = Boolean(body.estimateShowSchedule);
    if (body.holdbackPercent !== undefined) {
      const pct = Number(body.holdbackPercent);
      if (Number.isNaN(pct) || pct < 0 || pct > 100) {
        res.status(400).json({ error: "holdbackPercent must be between 0 and 100" });
        return;
      }
      update.holdback_percent = pct;
    }

    // Slug uniqueness spans every business, not just this one's own RLS-visible
    // row, so checking it needs the admin client — the update itself still
    // goes through req.supabase so RLS keeps enforcing "only your own row".
    if (body.slug !== undefined) {
      const normalized = slugify(String(body.slug));
      const admin = getSupabaseAdmin();
      const { data: collision } = await admin
        .from("businesses")
        .select("id")
        .eq("slug", normalized)
        .neq("id", req.businessId!)
        .maybeSingle();
      if (collision) {
        res.status(409).json({ error: "Ese link ya está en uso por otro negocio, elige otro." });
        return;
      }
      update.slug = normalized;
    }

    const { error } = await supabase.from("businesses").update(update).eq("id", req.businessId!);
    if (error) throw error;
    res.json({ ok: true });
  })
);

apiRouter.get(
  "/settings/margins",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("business_settings")
      .select("default_margin_type, default_waste_percent")
      .eq("business_id", req.businessId!)
      .single();

    if (error) throw error;

    res.json({
      defaultMarginType: data.default_margin_type,
      defaultWastePercent: Number(data.default_waste_percent),
    });
  })
);

apiRouter.get(
  "/settings/users",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const [users, roles] = await Promise.all([
      supabase
        .from("users")
        .select("id, name, email, phone, status, role_id, roles(name, permissions)")
        .eq("business_id", req.businessId!)
        .order("name"),
      supabase
        .from("roles")
        .select("id, name, permissions")
        .eq("business_id", req.businessId!),
    ]);

    if (users.error) throw users.error;
    if (roles.error) throw roles.error;

    res.json({
      // roleId and phone come back alongside the display fields so the
      // edit dialog can round-trip a user without a second request.
      users: users.data.map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone ?? null,
        status: u.status,
        roleId: u.role_id ?? null,
        role: u.roles?.name ?? null,
      })),
      roles: roles.data.map((r) => ({ id: r.id, name: r.name, permissions: r.permissions })),
    });
  })
);

// A bare `Router()` mounted directly into a raw connect/http middleware
// stack (as Vite's dev server uses) never gets Express's response-object
// patching (res.status/res.json come from `express()` app dispatch, not
// from Router itself) — so we export a fully-formed app here and mount
// *that* both in the Vite dev plugin and the production server, instead
// of mounting the router directly in either place.
export const apiApp = express();

// Behind the hosting proxy, req.protocol reports "http" because that is how
// the request reaches this process — the TLS ended at the proxy. Every URL
// this server hands to Stripe is built from it: the onboarding return address
// and the webhook endpoint it registers for itself. Both were being written
// as http://, which is the wrong address to publish for a site that is only
// reachable over https. Trusting X-Forwarded-Proto is what makes req.protocol
// tell the truth about how the person actually arrived.
apiApp.set("trust proxy", true);
// Stripe signature verification needs the exact raw bytes of the request
// body, so this one route is mounted with express.raw() ahead of the
// JSON parser below — every other route gets a parsed req.body as usual.
apiApp.post("/public/stripe/webhook", express.raw({ type: "application/json" }), (req, res, next) => {
  stripeWebhookHandler(req, res).catch(next);
});
apiApp.use(express.json());
apiApp.use(apiRouter);

// Every API failure has to answer JSON. Without this, an unhandled error
// falls through to Express's default handler, which replies with an HTML
// page — and every screen in this app does `await res.json()` on the way to
// reading the error message. The browser then reports a JSON parse failure
// ("The string did not match the expected pattern" in Safari) instead of
// what actually went wrong, which is how a Supabase outage ended up looking
// like a broken Stripe button.
apiApp.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Supabase rejects with a plain object ({ message, code, details, hint }),
  // not an Error, so String(err) yields "[object Object]" — a 500 that says
  // nothing. Reading the object's own fields is what turns an opaque failure
  // into a sentence that names the table and the column.
  const detail = (() => {
    if (err instanceof Error) return { message: err.message, stack: err.stack };
    if (err && typeof err === "object") {
      const e = err as Record<string, unknown>;
      const parts = [e.message, e.details, e.hint].filter(Boolean).map(String);
      return { message: parts.join(" — ") || JSON.stringify(e), code: e.code ? String(e.code) : undefined };
    }
    return { message: String(err) };
  })();

  console.error("[api]", detail.message, (detail as { stack?: string }).stack ?? "");
  if (res.headersSent) return;
  res.status(500).json({
    error: detail.message || "Unexpected server error",
    ...(detail.code ? { code: detail.code } : {}),
  });
});
