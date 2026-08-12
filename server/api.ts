import express, { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { randomUUID, randomBytes } from "crypto";
import { getSupabaseAdmin, SupabaseNotConfiguredError } from "./supabaseAdmin";
import { getStripe, getStripeWebhookSecret, StripeNotConfiguredError } from "./stripe";
import { flowCopy, normalizeFlowLang, type FlowLang } from "./flowMessages";
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
    event = stripe.webhooks.constructEvent(req.body, signature, getStripeWebhookSecret());
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
        .select("id, amount, status")
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
      }
    }
  }

  res.json({ received: true });
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
    const supabaseAnonKey = (process.env.VITE_SUPABASE_ANON_KEY ?? "").replace(/\s+/g, "");
    res.json({ supabaseUrl, supabaseAnonKey });
  })
);

// Unauthenticated config check. Deliberately reports only whether each piece
// is configured and reachable — never a key, or any part of one — so it is
// safe to open in a browser when a deployment misbehaves.
apiRouter.get(
  "/health",
  route(async (_req, res) => {
    const report: Record<string, unknown> = {
      supabaseUrlConfigured: Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
      supabaseServiceRoleKeyConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      supabaseAnonKeyConfigured: Boolean(process.env.VITE_SUPABASE_ANON_KEY),
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
    const { data: client } = await admin
      .from("clients")
      .select("id, name, business_id")
      .eq("access_token_hash", hashToken(token))
      .maybeSingle();

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

    const { data, error } = await admin
      .from("assignments")
      .select("projects(id, name)")
      .eq("business_id", req.workerBusinessId!)
      .eq(column, req.workerId!);
    if (error) throw error;

    const seen = new Set<string>();
    const projects = [];
    for (const row of data as any[]) {
      if (row.projects && !seen.has(row.projects.id)) {
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
    const { error } = await admin
      .from("time_entries")
      .update({
        check_out_time: new Date().toISOString(),
        check_out_location: `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`,
        check_out_lat: latitude,
        check_out_lng: longitude,
      })
      .eq("business_id", req.workerBusinessId!)
      .eq("id", req.params.id);
    if (error) throw error;

    res.json({ ok: true });
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

    const { error: closeError } = await admin
      .from("time_entries")
      .update({
        check_out_time: new Date().toISOString(),
        check_out_location: locationStr,
        check_out_lat: latitude,
        check_out_lng: longitude,
      })
      .eq("business_id", req.workerBusinessId!)
      .eq("id", activeEntryId);
    if (closeError) throw closeError;

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
      .select("id, sender_type, content, created_at")
      .eq("channel_id", channel.id)
      .order("created_at");
    if (error) throw error;
    res.json(data.map((m) => ({ id: m.id, senderType: m.sender_type, content: m.content, timestamp: m.created_at })));
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
      .select("id, sender_type, content, created_at")
      .single();
    if (error) throw error;
    res.status(201).json({ id: data.id, senderType: data.sender_type, content: data.content, timestamp: data.created_at });
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
        .select("id, name, progress_percent")
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

    res.json({
      client: { id: client.data.id, name: client.data.name },
      project: project.data
        ? { id: project.data.id, name: project.data.name, progressPercent: Number(project.data.progress_percent) }
        : null,
      estimate: estimate.data
        ? { id: estimate.data.id, status: estimate.data.status, total: Number(estimate.data.total) }
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
      .select("id, sender_type, content, created_at")
      .eq("channel_id", req.params.id)
      .order("created_at");
    if (error) throw error;
    res.json(data.map((m) => ({ id: m.id, senderType: m.sender_type, content: m.content, timestamp: m.created_at })));
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
      .select("id, sender_type, content, created_at")
      .single();
    if (error) throw error;
    res.status(201).json({ id: data.id, senderType: data.sender_type, content: data.content, timestamp: data.created_at });
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
      .select("id, sender_type, content, created_at")
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
      .select("id, sender_type, content, created_at")
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
        .select("id, name, trade, phone, rating, telegram_chat_id")
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
        telegramLinked: Boolean(s.telegram_chat_id),
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
        "id, client_id, project_id, status, created_by, category_id, description, total, created_at, clients(name), budget_categories(name)"
      )
      .eq("business_id", req.businessId!)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json(
      data.map((e: any) => ({
        id: e.id,
        clientId: e.client_id,
        clientName: e.clients?.name ?? null,
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
      .select("id, client_id, project_id, status")
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

    const [projects, expenses] = await Promise.all([
      supabase
        .from("projects")
        .select("id, name, estimate_id")
        .eq("business_id", req.businessId!)
        .order("name"),
      supabase
        .from("expenses")
        .select("project_id, category, amount")
        .eq("business_id", req.businessId!),
    ]);

    if (projects.error) throw projects.error;
    if (expenses.error) throw expenses.error;

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

    const result = projects.data.map((project) => {
      const categories = ["Materiales", "Mano de obra", "Subcontratistas"] as const;
      const rows = categories
        .map((category) => {
          const budgeted = lines
            .filter((l) => l.estimate_id === project.estimate_id && l.category === category)
            .reduce((sum, l) => sum + Number(l.total), 0);
          const actual = expenses.data
            .filter((e) => e.project_id === project.id && e.category === category)
            .reduce((sum, e) => sum + Number(e.amount), 0);
          return { category, budgeted, actual };
        })
        .filter((r) => r.budgeted > 0 || r.actual > 0);

      return { projectId: project.id, projectName: project.name, rows };
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
        .select("id, client_id, estimate_id, name, type, status, progress_percent, start_date, end_date, clients(name)")
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

    const [project, estimateLines, expenses, documents, photos, scheduleEvents, assignments] = await Promise.all([
      supabase
        .from("projects")
        .select("id, client_id, estimate_id, name, type, status, progress_percent, start_date, end_date, clients(name)")
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
    ]);

    if (project.error) throw project.error;
    if (estimateLines.error) throw estimateLines.error;
    if (expenses.error) throw expenses.error;
    if (documents.error) throw documents.error;
    if (photos.error) throw photos.error;
    if (scheduleEvents.error) throw scheduleEvents.error;
    if (assignments.error) throw assignments.error;

    const client = (project.data as any).clients as { name: string } | null;

    res.json({
      id: project.data.id,
      clientName: client?.name ?? null,
      name: project.data.name,
      type: project.data.type,
      status: project.data.status,
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
    const { data, error } = await supabase
      .from("projects")
      .insert({
        business_id: req.businessId!,
        client_id: clientId,
        estimate_id: estimateId ?? null,
        name: name.trim(),
        type: type?.trim() || null,
        status: "planificacion",
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
        .select("id, name, role, phone, status")
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
        .select("id, name, trade, phone, rating, telegram_chat_id")
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
        telegramLinked: Boolean(s.telegram_chat_id),
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

    res.json([...activeEmployees, ...activeSubcontractors]);
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
      .select("stripe_account_id, status, charges_enabled, payouts_enabled, details_submitted")
      .eq("business_id", req.businessId!)
      .maybeSingle();
    if (error) throw error;
    res.json({
      connected: !!data?.stripe_account_id,
      status: data?.status ?? "pending",
      chargesEnabled: data?.charges_enabled ?? false,
      payoutsEnabled: data?.payouts_enabled ?? false,
      detailsSubmitted: data?.details_submitted ?? false,
    });
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
      const { data: business } = await admin.from("businesses").select("name").eq("id", req.businessId!).single();
      const created = await stripe.accounts.create({
        type: "express",
        business_type: "company",
        company: { name: business?.name },
        business_profile: { name: business?.name, mcc: "1520" },
      });
      const { data: inserted, error: insertError } = await admin
        .from("stripe_connected_accounts")
        .upsert({ business_id: req.businessId!, stripe_account_id: created.id, status: "pending" }, { onConflict: "business_id" })
        .select("stripe_account_id")
        .single();
      if (insertError) throw insertError;
      account = inserted;
    }

    const link = await stripe.accountLinks.create({
      account: account.stripe_account_id!,
      refresh_url: `${baseUrl}/settings/pagos`,
      return_url: `${baseUrl}/settings/pagos?onboarding=completo`,
      type: "account_onboarding",
    });

    res.json({ url: link.url });
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

// ---------- Invoicing & Payments ----------

apiRouter.get(
  "/invoices",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("invoices")
      .select(
        "id, type, amount, subtotal, tax_amount, tax_breakdown, status, due_date, description, created_at, paid_at, projects(name), clients(name)"
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

    const admin = getSupabaseAdmin();
    const { taxAmount, breakdown } = await computeInvoiceTax(admin, req.businessId!, Number(subtotal));

    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("invoices")
      .insert({
        business_id: req.businessId!,
        client_id: clientId,
        project_id: projectId ?? null,
        estimate_id: estimateId ?? null,
        type,
        description: description ?? null,
        subtotal: Number(subtotal),
        tax_amount: taxAmount,
        tax_breakdown: breakdown,
        amount: Number(subtotal) + taxAmount,
        status: "pendiente",
        due_date: dueDate ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;

    res.status(201).json({ id: data.id });
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
      if (!["planificacion", "en_progreso", "pausado", "completado"].includes(body.status)) {
        res.status(400).json({ error: "invalid status" });
        return;
      }
      update.status = body.status;
    }
    if (body.progressPercent !== undefined) {
      const pct = Number(body.progressPercent);
      if (Number.isNaN(pct) || pct < 0 || pct > 100) {
        res.status(400).json({ error: "progressPercent must be between 0 and 100" });
        return;
      }
      update.progress_percent = pct;
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
    const { error } = await supabase
      .from("work_orders")
      .update(update)
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);
    if (error) throw error;
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

// ---------- Reports & Analytics ----------
// The month-by-month revenue/expense series is grouped from real payment
// and expense dates (not a stored aggregate, and not a fabricated series
// like the Fase A mock's hardcoded 6 months).
apiRouter.get(
  "/reports",
  route(async (req, res) => {
    const supabase = req.supabase!;

    const [payments, expenses, projects, employees, timeEntries, materialLines] = await Promise.all([
      supabase.from("payments").select("amount, paid_at").eq("business_id", req.businessId!),
      supabase.from("expenses").select("amount, date").eq("business_id", req.businessId!),
      supabase.from("projects").select("status").eq("business_id", req.businessId!),
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
      hoursByEmployee,
      topMaterials,
    });
  })
);

// ---------- Client Portal ----------

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
        ? { id: estimate.data.id, status: estimate.data.status, total: Number(estimate.data.total) }
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
      .select("id, sender_type, sender_id, content, created_at")
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
      .select("id, sender_type, sender_id, content, created_at")
      .single();
    if (error) throw error;
    res.status(201).json({
      id: data.id,
      senderType: data.sender_type,
      senderId: data.sender_id,
      content: data.content,
      timestamp: data.created_at,
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
      .select("id, name, slug, license_number, tax_config, province")
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
    });
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
        .select("id, name, email, status, roles(name, permissions)")
        .eq("business_id", req.businessId!)
        .order("name"),
      supabase
        .from("roles")
        .select("name, permissions")
        .eq("business_id", req.businessId!),
    ]);

    if (users.error) throw users.error;
    if (roles.error) throw roles.error;

    res.json({
      users: users.data.map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        status: u.status,
        role: u.roles?.name ?? null,
      })),
      roles: roles.data.map((r) => ({ name: r.name, permissions: r.permissions })),
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
// Stripe signature verification needs the exact raw bytes of the request
// body, so this one route is mounted with express.raw() ahead of the
// JSON parser below — every other route gets a parsed req.body as usual.
apiApp.post("/public/stripe/webhook", express.raw({ type: "application/json" }), (req, res, next) => {
  stripeWebhookHandler(req, res).catch(next);
});
apiApp.use(express.json());
apiApp.use(apiRouter);
