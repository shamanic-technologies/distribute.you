import { loadStripe, type Stripe } from "@stripe/stripe-js";

// Single shared Stripe.js instance for the whole app (loadStripe must be called
// once, outside render). Powers the in-modal Embedded Checkout (billing-guard).
let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!pk) {
      console.error(
        "[dashboard] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing — in-modal card capture (Embedded Checkout) cannot load.",
      );
      return Promise.resolve(null);
    }
    stripePromise = loadStripe(pk);
  }
  return stripePromise;
}
