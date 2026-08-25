const path = require("path");
const { PrismaClient } = require(path.resolve(__dirname, "../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client"));
const { resolveUserEntitlements, checkEntitlement, CANONICAL_PLANS } = require("../../entitlements/dist/index.js");

async function auditEntitlements() {
  const isReportOnly = process.argv.includes("--report-only");
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error("Fatal Error: DATABASE_URL environment variable is required.");
    process.exit(2);
  }

  let prisma;
  try {
    prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  } catch (e) {
    console.error("Prisma client initialization error:", e);
    process.exit(2);
  }

  console.log("=== BuildWorth Phase 4A Server-Authoritative Entitlements Audit ===");

  try {
    // 1. Non-vacuous check: Canonical plan catalog must be populated
    const dbPlans = await prisma.productPlan.findMany({
      include: {
        prices: true,
        entitlements: true,
      },
    });

    let defects = [];

    if (dbPlans.length < 2) {
      defects.push(`Canonical plan catalog incomplete: expected at least FREE and PRO, found ${dbPlans.length} plans.`);
    }

    const freeDbPlan = dbPlans.find((p) => p.code === "FREE");
    const proDbPlan = dbPlans.find((p) => p.code === "PRO");

    if (!freeDbPlan || !freeDbPlan.isActive) {
      defects.push("FREE plan is missing or inactive in database catalog.");
    }
    if (!proDbPlan || !proDbPlan.isActive) {
      defects.push("PRO plan is missing or inactive in database catalog.");
    }

    // Check plan entitlement matrix against canonical spec
    for (const plan of dbPlans) {
      const canonical = CANONICAL_PLANS[plan.code];
      if (canonical) {
        for (const [key, spec] of Object.entries(canonical.entitlements)) {
          const dbEnt = plan.entitlements.find((e) => e.entitlementType === key);
          if (!dbEnt) {
            defects.push(`Plan ${plan.code} missing entitlement ${key} in database.`);
          } else if (
            dbEnt.isUnlimited !== spec.isUnlimited ||
            dbEnt.limitQuantity !== spec.limitQuantity
          ) {
            defects.push(`Plan ${plan.code} entitlement ${key} mismatch: db(unlimited=${dbEnt.isUnlimited}, limit=${dbEnt.limitQuantity}) vs spec(unlimited=${spec.isUnlimited}, limit=${spec.limitQuantity})`);
          }
        }
      }
    }

    // 2. Audit Users, Subscriptions & Grants
    const users = await prisma.user.findMany({
      include: {
        billingSubscriptions: {
          include: {
            planPrice: {
              include: {
                plan: true,
              },
            },
          },
        },
        entitlementGrants: true,
      },
    });

    const now = new Date();
    let freeResolutionsCount = 0;
    let paidResolutionsCount = 0;

    for (const user of users) {
      const ctx = resolveUserEntitlements(user, now);
      if (ctx.tier === "FREE") freeResolutionsCount++;
      if (ctx.tier === "PRO" || ctx.tier === "TEAM" || ctx.tier === "ENTERPRISE") paidResolutionsCount++;

      // Check: Legacy User.tier projection must match or be detected
      const hasValidSub = (user.billingSubscriptions || []).some(
        (s) =>
          (s.status === "ACTIVE" || s.status === "TRIALING") &&
          new Date(s.currentPeriodEnd) > now &&
          s.planPrice?.plan?.isActive
      );

      const hasValidGrant = (user.entitlementGrants || []).some(
        (g) => g.isUnlimited && (!g.expiresAt || new Date(g.expiresAt) > now)
      );

      // Check legacy User.tier="PRO" without valid subscription/grant
      if (user.tier === "PRO" && !hasValidSub && !hasValidGrant) {
        defects.push(`Legacy User.tier='PRO' projection mismatch on user ${user.id} without authoritative subscription.`);
      }

      // Check: Unauthorized paid tier resolved
      if (!hasValidSub && !hasValidGrant && ctx.tier !== "FREE") {
        defects.push(`User ${user.id} resolved commercial tier ${ctx.tier} without valid subscription or grant.`);
      }

      // Check: Expired subscription leak
      for (const sub of user.billingSubscriptions || []) {
        if (new Date(sub.currentPeriodEnd) < now && sub.status === "ACTIVE") {
          if (ctx.tier === sub.planPrice.plan.code.toUpperCase()) {
            defects.push(`Expired subscription ${sub.id} granted tier to user ${user.id}.`);
          }
        }
      }
    }

    // 3. Audit Usage Ledgers & Numeric Limits
    const usageRecordsCount = await prisma.usageLedger.count();
    const periodBuckets = await prisma.usageLedger.groupBy({
      by: ["userId", "entitlementType", "periodBucketKey"],
      _sum: { unitsConsumed: true },
    });

    let numericChecksCount = 0;
    for (const bucket of periodBuckets) {
      numericChecksCount++;
      const user = users.find((u) => u.id === bucket.userId);
      if (user) {
        const ctx = resolveUserEntitlements(user, now);
        const ent = ctx.entitlements[bucket.entitlementType];
        if (ent && !ent.isUnlimited && ent.limitQuantity !== null) {
          const consumed = bucket._sum.unitsConsumed ?? 0;
          if (consumed > ent.limitQuantity) {
            defects.push(`Usage over-allocation detected: User ${bucket.userId} consumed ${consumed}/${ent.limitQuantity} in ${bucket.periodBucketKey} for ${bucket.entitlementType}.`);
          }
        }
      }
    }

    console.log("----------------------------------------------------------------");
    console.log(`Total Plans Audited             : ${dbPlans.length}`);
    console.log(`Total Users Audited             : ${users.length} (FREE: ${freeResolutionsCount}, Paid: ${paidResolutionsCount})`);
    console.log(`Usage Records Audited           : ${usageRecordsCount}`);
    console.log(`Accounting Buckets Checked      : ${numericChecksCount}`);
    console.log(`Total Defects Found             : ${defects.length}`);
    console.log("----------------------------------------------------------------");

    if (defects.length > 0) {
      console.error("Defects detected:");
      defects.forEach((d, idx) => console.error(` [${idx + 1}] ${d}`));
      if (isReportOnly) {
        console.log("Report-only mode enabled: Exiting with code 0.");
        process.exit(0);
      } else {
        console.error("Entitlements Audit Result: FAILED (Exit code 1)");
        process.exit(1);
      }
    }

    console.log("Entitlements Audit Result: CLEAN PASS (Exit code 0)");
    process.exit(0);
  } catch (err) {
    console.error("Fatal audit execution failure:", err);
    process.exit(2);
  } finally {
    if (prisma) await prisma.$disconnect();
  }
}

auditEntitlements();
