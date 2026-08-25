import Stripe from "stripe";
import { PrismaClient } from "@buildworth/database";

export async function ensureBillingCustomer(
  prisma: PrismaClient,
  stripe: Stripe,
  userId: string,
  userEmail: string,
  userName?: string | null
): Promise<{ customerId: string; billingCustomerId: string }> {
  // Check if BillingCustomer already exists in DB
  const existing = await prisma.billingCustomer.findUnique({
    where: { userId },
  });

  if (existing) {
    return {
      customerId: existing.stripeCustomerId,
      billingCustomerId: existing.id,
    };
  }

  // Create customer in Stripe idempotently
  const stripeCustomer = await stripe.customers.create(
    {
      email: userEmail,
      name: userName || undefined,
      metadata: {
        userId,
      },
    },
    {
      idempotencyKey: `create_customer_${userId}`,
    }
  );

  // Store BillingCustomer in DB
  const record = await prisma.billingCustomer.create({
    data: {
      userId,
      stripeCustomerId: stripeCustomer.id,
      billingEmail: userEmail,
      currency: "USD",
    },
  });

  return {
    customerId: stripeCustomer.id,
    billingCustomerId: record.id,
  };
}
