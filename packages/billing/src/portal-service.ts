import Stripe from "stripe";
import { PrismaClient } from "@buildworth/database";
import { getBillingConfig } from "./config.js";

export interface CreateBillingPortalSessionParams {
  userId: string;
  returnUrlOverride?: string;
}

export interface CreateBillingPortalSessionResult {
  portalUrl: string;
}

export async function createBillingPortalSession(
  prisma: PrismaClient,
  stripe: Stripe,
  params: CreateBillingPortalSessionParams
): Promise<CreateBillingPortalSessionResult> {
  const config = getBillingConfig();
  const returnUrl = params.returnUrlOverride || `${config.appUrl}/pricing`;

  // 1. Verify BillingCustomer exists for user
  const customer = await prisma.billingCustomer.findUnique({
    where: { userId: params.userId },
  });

  if (!customer || !customer.stripeCustomerId) {
    throw new Error("CUSTOMER_NOT_FOUND: No billing customer record found for this user.");
  }

  // 2. Create Stripe Billing Portal session
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customer.stripeCustomerId,
    return_url: returnUrl,
  });

  if (!portalSession.url) {
    throw new Error("STRIPE_PORTAL_ERROR: Failed to generate customer portal URL.");
  }

  return {
    portalUrl: portalSession.url,
  };
}
