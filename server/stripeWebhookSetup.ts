import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "./stripe";

/**
 * The server setting up its own Stripe webhook.
 *
 * Stripe hands out a signing secret exactly once, at the moment an endpoint is
 * created, and never shows it through the API again. The usual consequence is
 * a manual step: find the value in the dashboard, copy it without a typo,
 * paste it into the hosting panel. That step failed twice here — once because
 * the endpoint was pointed at the site root instead of the API path, once
 * because the dashboard would not show the secret at all — and each failure
 * was invisible, since a webhook that never arrives looks exactly like a
 * customer who never paid.
 *
 * So the server does it. It already holds the Stripe secret key, which is
 * strictly more powerful than any signing secret, so nothing new is trusted
 * here. It asks Stripe whether an endpoint for its own address exists, creates
 * one if not, and keeps the secret it is given.
 *
 * The environment variable still works and still wins. This is the fallback
 * for a deployment where nobody wants to shuttle secrets by hand.
 */

type Db = SupabaseClient;

/** Where the secrets live in platform_config. One row, comma-separated. */
const CONFIG_KEY = "stripe_webhook_secrets";

/**
 * Which events this app actually handles, and where they come from.
 *
 * `@accounts` is not a detail: charges are direct charges on the contractor's
 * own account, so `checkout.session.completed` is born there, not here. An
 * endpoint scoped to the platform receives none of them, which is a payment
 * system that silently never confirms anything.
 */
const SCOPE = "@accounts";
const EVENTS = ["checkout.session.completed", "account.updated"];

/** Accounts v2 refuses a request with no explicit version. Pinned so a change
 *  at Stripe cannot reshape this without somebody choosing it. */
const API_VERSION = "2026-06-24.preview";

export async function readStoredWebhookSecrets(db: Db): Promise<string[]> {
  const { data } = await db.from("platform_config").select("value").eq("key", CONFIG_KEY).maybeSingle();
  return (data?.value ?? "")
    .split(",")
    .map((secret: string) => secret.trim())
    .filter(Boolean);
}

async function storeWebhookSecret(db: Db, secret: string): Promise<void> {
  const existing = await readStoredWebhookSecrets(db);
  if (existing.includes(secret)) return;

  // Appended rather than replaced. An endpoint that is still live keeps
  // sending events signed with its own secret, and dropping it here would
  // start refusing them the moment a second endpoint appeared.
  const merged = [...existing, secret].join(",");
  await db.from("platform_config").upsert(
    { key: CONFIG_KEY, value: merged, updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );
}

export interface ProvisionResult {
  /** What happened, in a word the caller can show. */
  outcome: "created" | "already_configured" | "exists_without_secret";
  destinationId: string | null;
  url: string;
}

/**
 * Makes sure a connected-accounts webhook exists for this deployment's URL.
 *
 * Returns `exists_without_secret` when Stripe already has an endpoint on this
 * address but the secret was never stored here — Stripe will not repeat it, so
 * the only way forward is to replace that endpoint, which is a decision for a
 * person rather than a surprise this function springs on them.
 */
export async function provisionWebhook(db: Db, baseUrl: string): Promise<ProvisionResult> {
  const stripe = getStripe();
  const url = `${baseUrl.replace(/\/+$/, "")}/api/public/stripe/webhook`;

  const existing = (await stripe.v2.core.eventDestinations.list(
    { limit: 100, include: ["webhook_endpoint.url"] } as never,
    { apiVersion: API_VERSION } as never
  )) as unknown as { data: { id: string; events_from?: string[]; webhook_endpoint?: { url?: string } }[] };

  const match = (existing.data ?? []).find(
    (destination) =>
      destination.webhook_endpoint?.url === url && (destination.events_from ?? []).includes(SCOPE)
  );

  if (match) {
    const stored = await readStoredWebhookSecrets(db);
    return {
      outcome: stored.length > 0 ? "already_configured" : "exists_without_secret",
      destinationId: match.id,
      url,
    };
  }

  const created = (await stripe.v2.core.eventDestinations.create(
    {
      name: "Field Construction",
      description: "Pagos de facturas y estado de las cuentas conectadas",
      type: "webhook_endpoint",
      event_payload: "snapshot",
      events_from: [SCOPE],
      enabled_events: EVENTS,
      webhook_endpoint: { url },
      include: ["webhook_endpoint.signing_secret"],
    } as never,
    { apiVersion: API_VERSION } as never
  )) as unknown as { id: string; webhook_endpoint?: { signing_secret?: string } };

  const secret = created.webhook_endpoint?.signing_secret;
  if (!secret) {
    // Stripe made the endpoint but withheld the secret. Leaving it behind
    // would be an endpoint nothing can verify, quietly failing forever.
    await stripe.v2.core.eventDestinations
      .del(created.id, {} as never, { apiVersion: API_VERSION } as never)
      .catch(() => undefined);
    throw new Error("Stripe created the endpoint but returned no signing secret");
  }

  await storeWebhookSecret(db, secret);
  return { outcome: "created", destinationId: created.id, url };
}
