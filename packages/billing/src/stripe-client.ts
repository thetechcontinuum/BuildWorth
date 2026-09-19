import Stripe from "stripe";
import { getBillingConfig } from "./config.js";

let stripeInstance: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!stripeInstance) {
    const config = getBillingConfig();
    stripeInstance = new Stripe(config.stripeSecretKey, {
      apiVersion: "2024-06-20",
      typescript: true,
    });
  }
  return stripeInstance;
}
