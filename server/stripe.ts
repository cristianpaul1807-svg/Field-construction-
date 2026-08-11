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

export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new StripeNotConfiguredError();
  }
  return secret;
}
