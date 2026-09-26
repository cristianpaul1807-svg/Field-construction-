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
 * De dónde vienen los eventos, que son dos sitios y no uno.
 *
 * `@accounts`: los cobros de facturas son cargos directos en la cuenta del
 * contratista, así que su `checkout.session.completed` nace allí. Un endpoint
 * de la plataforma no recibe ninguno.
 *
 * `@self`: nuestra suscripción. El negocio nos paga a nosotros, y la
 * suscripción, sus facturas y su checkout nacen en esta cuenta. Esto sólo
 * escuchaba `@accounts`, y la cuenta de antes funcionaba porque alguien había
 * creado a mano un segundo endpoint. En una cuenta nueva no existiría: el
 * negocio pagaría Entreprise y el plan no se movería.
 *
 * Un destino por origen, porque el panel de Stripe obliga a elegir uno. Cada
 * uno tiene su secreto; se guardan los dos.
 */
const SCOPES = ["@self", "@accounts"] as const;
/**
 * Lo que le pedimos a Stripe que nos cuente.
 *
 * Los dos primeros son de Connect: el cliente de un contratista pagando una
 * factura, y Stripe cambiando de opinión sobre la cuenta del contratista.
 *
 * Los cuatro de abajo son **nuestra** suscripción, y sin ellos nada de la
 * pantalla de Suscripción sirve para nada: el plan del negocio se quedaría en
 * el que tenía para siempre. Alguien pagaría Entreprise y seguiría sin ver las
 * nóminas, y alguien que cancela las seguiría viendo un año.
 *
 * Añadir uno aquí no basta para un despliegue que ya tiene su endpoint creado:
 * Stripe guarda la lista en el suyo. Hay que volver a provisionarlo, o
 * añadirlo a mano en el panel de Stripe.
 */
const EVENTS = [
  "checkout.session.completed",
  "account.updated",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
  // El cobro que **sí** sale bien. Faltaba, y `server/api.ts` lleva desde
  // siempre un manejador para él que no se ejecutaba nunca: la renovación
  // mensual se cobraba en Stripe y aquí no se movía nada, así que la pantalla
  // seguía enseñando la fecha de renovación del mes pasado para siempre.
  // `scripts/check-webhook-events.py` existe para que no vuelva a faltar uno.
  "invoice.payment_succeeded",
];

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
  /** What happened, in a word the caller can show. The worst of the two scopes. */
  outcome: "created" | "already_configured" | "exists_without_secret";
  destinations: { scope: string; outcome: ProvisionResult["outcome"]; destinationId: string }[];
  url: string;
}

/**
 * Makes sure this deployment's URL gets the platform's events and the
 * connected accounts' events.
 *
 * `exists_without_secret` means Stripe already has an endpoint on this address
 * whose secret was never stored here — Stripe will not repeat it, so the only
 * way forward is to replace that endpoint, which is a decision for a person
 * rather than a surprise this function springs on them.
 */
export async function provisionWebhook(db: Db, baseUrl: string): Promise<ProvisionResult> {
  const stripe = getStripe();

  // Forced to https unless it is a local address. A hosting proxy ends the TLS
  // and forwards plain http, so the server sees "http" and would publish that
  // as the address Stripe should post payment confirmations to — in the clear,
  // to a host that only answers over https. Getting this wrong once already
  // registered an http:// endpoint that had to be thrown away.
  const normalized = baseUrl.replace(/\/+$/, "");
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(normalized);
  const secure = isLocal ? normalized : normalized.replace(/^http:\/\//i, "https://");
  const url = `${secure}/api/public/stripe/webhook`;

  const existing = (await stripe.v2.core.eventDestinations.list(
    { limit: 100, include: ["webhook_endpoint.url"] } as never,
    { apiVersion: API_VERSION } as never
  )) as unknown as { data: { id: string; events_from?: string[]; webhook_endpoint?: { url?: string } }[] };
  const stored = await readStoredWebhookSecrets(db);

  const destinations: ProvisionResult["destinations"] = [];
  for (const scope of SCOPES) {
    const match = (existing.data ?? []).find(
      (destination) =>
        destination.webhook_endpoint?.url === url && (destination.events_from ?? []).includes(scope)
    );
    if (match) {
      destinations.push({
        scope,
        outcome: stored.length > 0 ? "already_configured" : "exists_without_secret",
        destinationId: match.id,
      });
      continue;
    }

    const created = (await stripe.v2.core.eventDestinations.create(
      {
        name: scope === "@self" ? "Logiciel - Suscripciones" : "Logiciel - Construction",
        description:
          scope === "@self"
            ? "Suscripción de cada negocio a la plataforma"
            : "Pagos de facturas y estado de las cuentas conectadas",
        type: "webhook_endpoint",
        event_payload: "snapshot",
        events_from: [scope],
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
      throw new Error(`Stripe created the ${scope} endpoint but returned no signing secret`);
    }

    await storeWebhookSecret(db, secret);
    destinations.push({ scope, outcome: "created", destinationId: created.id });
  }

  const outcome = destinations.some((d) => d.outcome === "exists_without_secret")
    ? "exists_without_secret"
    : destinations.some((d) => d.outcome === "created")
      ? "created"
      : "already_configured";
  return { outcome, destinations, url };
}
