import Stripe from "stripe";

// Server-only client using the platform's Stripe secret key — never sent to
// the browser. Each business connects its OWN Stripe Express account
// (server/api.ts "Stripe Connect" section); this client only ever acts on
// their behalf via the `stripeAccount` request option (direct charges), so
// the money, fees, disputes and payouts all belong to the connected
// account, not to this platform key's own account.
export class StripeNotConfiguredError extends Error {
  constructor() {
    super("STRIPE_SECRET_KEY is not set. Configure it as an environment variable before using payments.");
    this.name = "StripeNotConfiguredError";
  }
}

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (client) return client;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new StripeNotConfiguredError();
  }

  client = new Stripe(secretKey);
  return client;
}

/**
 * Every signing secret this deployment will accept.
 *
 * More than one, because a Connect platform genuinely needs more than one
 * endpoint: events about a contractor's own payments come from the connected
 * account and events about the platform come from the platform, and Stripe
 * gives each scope its own secret. One value here meant only one of the two
 * could ever be verified, and the other arrived, failed its signature check,
 * and was dropped — silently, since a rejected webhook looks identical to an
 * attack.
 *
 * It also makes rotation survivable: put both the old and the new secret in
 * during the changeover instead of choosing which minute to break.
 *
 * Comma-separated. Whitespace around each entry is forgiven — these get
 * pasted into hosting panels by hand.
 */
export function getStripeWebhookSecrets(): string[] {
  const raw = process.env.STRIPE_WEBHOOK_SECRET;
  const secrets = (raw ?? "")
    .split(",")
    .map((secret) => secret.trim())
    .filter(Boolean);
  if (secrets.length === 0) {
    throw new StripeNotConfiguredError();
  }
  return secrets;
}

/** The first configured secret. Kept for callers that only need to know one
 *  exists; verification should use `getStripeWebhookSecrets`. */
export function getStripeWebhookSecret(): string {
  return getStripeWebhookSecrets()[0];
}
