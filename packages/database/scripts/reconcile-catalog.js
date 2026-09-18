const path = require("path");
const { PrismaClient } = require(
  path.resolve(
    __dirname,
    "../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client",
  ),
);
const { CANONICAL_PLANS } = require("../../entitlements/dist/index.js");

async function reconcileCatalog() {
  const dbUrl =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5440/postgres?schema=public";
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  console.log("=== BuildWorth Canonical Plan Catalog Reconciliation ===");

  try {
    const planCodes = Object.keys(CANONICAL_PLANS);

    for (let i = 0; i < planCodes.length; i++) {
      const code = planCodes[i];
      const cfg = CANONICAL_PLANS[code];

      // 1. Reconcile ProductPlan
      const plan = await prisma.productPlan.upsert({
        where: { code },
        update: {
          name: cfg.name,
          description: cfg.description,
          isActive: cfg.isActive,
          sortOrder: i,
        },
        create: {
          code,
          name: cfg.name,
          description: cfg.description,
          isActive: cfg.isActive,
          sortOrder: i,
        },
      });

      console.log(`Plan [${code}]: isActive=${plan.isActive}, sortOrder=${plan.sortOrder}`);

      // 2. Reconcile Plan Prices (USD Minor units: cents)
      const envMonthlyStripeId = process.env.STRIPE_PRO_MONTHLY_PRICE_ID || null;
      const envAnnualStripeId = process.env.STRIPE_PRO_YEARLY_PRICE_ID || null;

      // Monthly Price
      if (cfg.monthlyPriceCents > 0 || code === "FREE") {
        const monthlyStripeId = code === "PRO" ? envMonthlyStripeId : null;
        const existingMonthly = await prisma.planPrice.findFirst({
          where: { planId: plan.id, billingInterval: "MONTHLY" },
        });
        if (existingMonthly) {
          await prisma.planPrice.update({
            where: { id: existingMonthly.id },
            data: {
              amountCents: cfg.monthlyPriceCents,
              currency: "USD",
              isActive: cfg.isActive,
              stripePriceId: monthlyStripeId,
            },
          });
        } else {
          await prisma.planPrice.create({
            data: {
              id: `price_${code.toLowerCase()}_monthly`,
              planId: plan.id,
              stripePriceId: monthlyStripeId,
              billingInterval: "MONTHLY",
              amountCents: cfg.monthlyPriceCents,
              currency: "USD",
              isActive: cfg.isActive,
            },
          });
        }
      }

      // Annual Price
      if (cfg.annualPriceCents > 0) {
        const annualStripeId = code === "PRO" ? envAnnualStripeId : null;
        const existingAnnual = await prisma.planPrice.findFirst({
          where: { planId: plan.id, billingInterval: "ANNUAL" },
        });
        if (existingAnnual) {
          await prisma.planPrice.update({
            where: { id: existingAnnual.id },
            data: {
              amountCents: cfg.annualPriceCents,
              currency: "USD",
              isActive: cfg.isActive,
              stripePriceId: annualStripeId,
            },
          });
        } else {
          await prisma.planPrice.create({
            data: {
              id: `price_${code.toLowerCase()}_annual`,
              planId: plan.id,
              stripePriceId: annualStripeId,
              billingInterval: "ANNUAL",
              amountCents: cfg.annualPriceCents,
              currency: "USD",
              isActive: cfg.isActive,
            },
          });
        }
      }

      // 3. Reconcile Plan Entitlements Matrix
      for (const [entKey, entCfg] of Object.entries(cfg.entitlements)) {
        await prisma.planEntitlement.upsert({
          where: {
            planId_entitlementType: {
              planId: plan.id,
              entitlementType: entKey,
            },
          },
          update: {
            isUnlimited: entCfg.isUnlimited,
            limitQuantity: entCfg.limitQuantity,
            resetInterval: entCfg.resetInterval,
          },
          create: {
            planId: plan.id,
            entitlementType: entKey,
            isUnlimited: entCfg.isUnlimited,
            limitQuantity: entCfg.limitQuantity,
            resetInterval: entCfg.resetInterval,
          },
        });
      }
    }

    console.log("---------------------------------------------------------");
    console.log("Catalog Reconciliation Completed Successfully (Idempotent).");
    console.log("---------------------------------------------------------");
  } finally {
    await prisma.$disconnect();
  }
}

reconcileCatalog().catch((err) => {
  console.error("Catalog reconciliation failed:", err);
  process.exit(1);
});
