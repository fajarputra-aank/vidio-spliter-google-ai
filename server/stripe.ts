import Stripe from "stripe";

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe belum dikonfigurasi. Periksa Settings → Payment.");
  return new Stripe(key);
}
