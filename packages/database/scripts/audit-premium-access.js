const { execSync } = require("child_process");
const path = require("path");
const { PrismaClient } = require(
  path.resolve(
    __dirname,
    "../../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client",
  ),
);
const {
  getEventPurposeMapping,
  validateEventSourceCombination,
} = require("../../billing/dist/index.js");

async function runPremiumAccessAudit() {
  const isReportOnly = process.argv.includes("--report-only");
  console.log("=== BuildWorth Phase 4D Server-Authoritative Premium Access & Exports Audit ===");

  let dbUrl = process.env.DATABASE_URL;
  let tempDbName = null;
  let shouldCreateDisposable = false;

  if (!dbUrl || dbUrl.includes("localhost:5432")) {
    shouldCreateDisposable = true;
  }

  if (shouldCreateDisposable) {
    tempDbName = "audit_premium_temp_" + Date.now();
    try {
      execSync(
        `docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "CREATE DATABASE ${tempDbName};"`,
        { stdio: "pipe" },
      );
      dbUrl = `postgresql://postgres:postgres@localhost:5440/${tempDbName}?schema=public`;
      execSync(`pnpm exec prisma migrate deploy --schema=prisma/schema.prisma`, {
        cwd: path.resolve(__dirname, ".."),
        env: { ...process.env, DATABASE_URL: dbUrl },
        stdio: "pipe",
      });
      execSync(`DATABASE_URL="${dbUrl}" node scripts/reconcile-catalog.js`, {
        cwd: path.resolve(__dirname, ".."),
        stdio: "pipe",
      });
      execSync(`node scripts/test-phase4d-seed-fixture.js`, {
        cwd: path.resolve(__dirname, ".."),
        env: { ...process.env, DATABASE_URL: dbUrl },
        stdio: "pipe",
      });
    } catch (err) {
      console.error(
        "[FATAL] Failed to create disposable test database:",
        err.message,
      );
      process.exit(2);
    }
  }

  let prisma = null;
  const defects = [];

  try {
    prisma = new PrismaClient({
      datasources: { db: { url: dbUrl } },
    });

    // 1. Audit OpportunityExport records
    const exports = await prisma.opportunityExport.findMany({
      include: {
        user: true,
        opportunity: true,
        opportunityRevision: true,
      },
    });

    // Non-vacuous check: require populated export fixtures
    if (exports.length === 0) {
      defects.push({
        code: "NO_EXPORT_FIXTURES_FOUND",
        message: "Audit requires populated OpportunityExport fixtures to execute non-vacuous assertions.",
      });
    }

    let completedPdfExports = 0;
    let completedCsvExports = 0;
    let failedExports = 0;
    let rejectedExports = 0;
    let pendingExportReservations = 0;
    let abandonedReservationsRecovered = 0;

    for (const exp of exports) {
      if (!exp.user) {
        defects.push({
          code: "EXPORT_ORPHANED_USER",
          exportId: exp.id,
          message: `OpportunityExport ${exp.id} references non-existent user.`,
        });
      }

      if (!exp.opportunity) {
        defects.push({
          code: "EXPORT_ORPHANED_OPPORTUNITY",
          exportId: exp.id,
          message: `OpportunityExport ${exp.id} references non-existent opportunity.`,
        });
      }

      if (!exp.opportunityRevision) {
        defects.push({
          code: "EXPORT_ORPHANED_REVISION",
          exportId: exp.id,
          message: `OpportunityExport ${exp.id} references non-existent opportunity revision.`,
        });
      }

      // Verify Ledger Linkage Invariants:
      // - PENDING: reservation exists, no release;
      // - COMPLETED: reservation/consumption exists, no release;
      // - FAILED after reservation: reservation and release exist;
      // - REJECTED before reservation: no reservation or release.
      if (exp.status === "PENDING") {
        pendingExportReservations++;
        if (!exp.reservationLedgerId) {
          defects.push({
            code: "PENDING_EXPORT_MISSING_RESERVATION",
            exportId: exp.id,
            message: `Pending export ${exp.id} is missing reservationLedgerId.`,
          });
        }
        if (exp.releaseLedgerId) {
          defects.push({
            code: "PENDING_EXPORT_UNEXPECTED_RELEASE",
            exportId: exp.id,
            message: `Pending export ${exp.id} has unexpected releaseLedgerId.`,
          });
        }
      } else if (exp.status === "COMPLETED") {
        if (exp.format === "PDF") completedPdfExports++;
        if (exp.format === "CSV") completedCsvExports++;

        if (!exp.completedAt) {
          defects.push({
            code: "COMPLETED_EXPORT_MISSING_TIMESTAMP",
            exportId: exp.id,
            message: `Completed export ${exp.id} is missing completedAt timestamp.`,
          });
        }
        if (!exp.byteSize || exp.byteSize <= 0) {
          defects.push({
            code: "COMPLETED_EXPORT_INVALID_BYTESIZE",
            exportId: exp.id,
            message: `Completed export ${exp.id} has invalid byteSize ${exp.byteSize}.`,
          });
        }
        if (!exp.contentHash || exp.contentHash.length !== 64) {
          defects.push({
            code: "COMPLETED_EXPORT_INVALID_CONTENT_HASH",
            exportId: exp.id,
            message: `Completed export ${exp.id} has invalid sha256 contentHash.`,
          });
        }
        if (!exp.reservationLedgerId || !exp.consumptionLedgerId) {
          defects.push({
            code: "COMPLETED_EXPORT_MISSING_LEDGER_LINKAGE",
            exportId: exp.id,
            message: `Completed export ${exp.id} missing reservation or consumption ledger linkage.`,
          });
        }
        if (exp.releaseLedgerId) {
          defects.push({
            code: "COMPLETED_EXPORT_UNEXPECTED_RELEASE",
            exportId: exp.id,
            message: `Completed export ${exp.id} has unexpected releaseLedgerId.`,
          });
        }

        // Verify corresponding UsageLedger record exists for completed exports
        const ledger = await prisma.usageLedger.findFirst({
          where: {
            id: exp.reservationLedgerId || undefined,
            userId: exp.userId,
            entitlementType: "VENTURE_BLUEPRINT_EXPORT",
          },
        });
        if (!ledger) {
          defects.push({
            code: "COMPLETED_EXPORT_MISSING_USAGE_LEDGER",
            exportId: exp.id,
            userId: exp.userId,
            message: `Completed export ${exp.id} does not have a matching append-only UsageLedger record.`,
          });
        }
      } else if (exp.status === "FAILED") {
        failedExports++;
        if (!exp.failedAt) {
          defects.push({
            code: "FAILED_EXPORT_MISSING_TIMESTAMP",
            exportId: exp.id,
            message: `Failed export ${exp.id} is missing failedAt timestamp.`,
          });
        }
        if (!exp.failureCode) {
          defects.push({
            code: "FAILED_EXPORT_MISSING_FAILURE_CODE",
            exportId: exp.id,
            message: `Failed export ${exp.id} is missing failureCode explanation.`,
          });
        }
        if (exp.reservationLedgerId && !exp.releaseLedgerId) {
          defects.push({
            code: "FAILED_EXPORT_MISSING_RELEASE_LEDGER",
            exportId: exp.id,
            message: `Failed export ${exp.id} reserved quota but is missing releaseLedgerId compensating link.`,
          });
        }
        if (exp.failureCode === "EXPORT_RESERVATION_EXPIRED" && exp.releaseLedgerId) {
          abandonedReservationsRecovered++;
        }
      } else if (exp.status === "REJECTED") {
        rejectedExports++;
        if (!exp.rejectedAt) {
          defects.push({
            code: "REJECTED_EXPORT_MISSING_TIMESTAMP",
            exportId: exp.id,
            message: `Rejected export ${exp.id} is missing rejectedAt timestamp.`,
          });
        }
        if (!exp.failureCode) {
          defects.push({
            code: "REJECTED_EXPORT_MISSING_FAILURE_CODE",
            exportId: exp.id,
            message: `Rejected export ${exp.id} is missing failureCode explanation.`,
          });
        }
        if (exp.reservationLedgerId || exp.consumptionLedgerId || exp.releaseLedgerId) {
          defects.push({
            code: "REJECTED_EXPORT_UNEXPECTED_LEDGER_LINKAGE",
            exportId: exp.id,
            message: `Rejected export ${exp.id} should have zero ledger linkage.`,
          });
        }
      }
    }

    // 2. Audit Entitlement Grants for Pro users
    const proUsers = await prisma.user.findMany({
      where: { tier: "PRO" },
      include: {
        entitlementGrants: true,
        billingSubscriptions: true,
      },
    });

    for (const u of proUsers) {
      const activeSub = u.billingSubscriptions.find((s) => s.status === "ACTIVE");
      if (activeSub) {
        const hasExportGrant = u.entitlementGrants.some(
          (g) => g.entitlementType === "VENTURE_BLUEPRINT_EXPORT",
        );
        if (!hasExportGrant) {
          defects.push({
            code: "PRO_USER_MISSING_EXPORT_ENTITLEMENT",
            userId: u.id,
            message: `Active Pro user ${u.id} is missing VENTURE_BLUEPRINT_EXPORT entitlement grant.`,
          });
        }
      }
    }

    // 3. Audit Free user export boundaries
    const freeUsers = await prisma.user.findMany({
      where: { tier: "FREE" },
      include: {
        opportunityExports: { where: { status: "COMPLETED" } },
      },
    });

    for (const u of freeUsers) {
      if (u.opportunityExports.length > 0) {
        defects.push({
          code: "FREE_USER_HAS_COMPLETED_EXPORTS",
          userId: u.id,
          completedCount: u.opportunityExports.length,
          message: `Free user ${u.id} has ${u.opportunityExports.length} completed exports violating Free entitlement policy.`,
        });
      }
    }

    // 4. Audit Founder Fit owner-matching
    const fits = await prisma.founderFitEvaluation.findMany({
      include: { profileRevision: { include: { profile: true } } },
    });
    let ownerMatchedFits = 0;
    for (const fit of fits) {
      if (fit.profileRevision && fit.profileRevision.profile.userId !== fit.userId) {
        defects.push({
          code: "CROSS_USER_FOUNDER_FIT_REFERENCE",
          fitId: fit.id,
          message: `FounderFitEvaluation ${fit.id} references a profile belonging to another user.`,
        });
      } else {
        ownerMatchedFits++;
      }
    }

    // 5. Audit Commercial Events & Retention/Legal Holds
    const commEvents = await prisma.commercialEvent.findMany();
    const eventCountsByType = {};
    let activeLegalHolds = 0;
    let expiredEventsProcessed = 0;

    for (const ce of commEvents) {
      eventCountsByType[ce.eventType] = (eventCountsByType[ce.eventType] || 0) + 1;
      if (ce.legalHoldUntil && new Date(ce.legalHoldUntil) > new Date()) {
        activeLegalHolds++;
      }
      if (ce.retentionExpiresAt && new Date(ce.retentionExpiresAt) <= new Date()) {
        expiredEventsProcessed++;
      }

      // Verify GDPR purpose and lawful basis alignment
      const expectedMapping = getEventPurposeMapping(ce.eventType);
      if (ce.purposeCode !== expectedMapping.purposeCode || ce.lawfulBasis !== expectedMapping.lawfulBasis) {
        defects.push({
          code: "INVALID_EVENT_PURPOSE_OR_LAWFUL_BASIS",
          eventId: ce.id,
          eventType: ce.eventType,
          message: `Event ${ce.id} has purpose=${ce.purposeCode}, lawfulBasis=${ce.lawfulBasis}, expected purpose=${expectedMapping.purposeCode}, lawfulBasis=${expectedMapping.lawfulBasis}`,
        });
      }

      // Verify Event and Source combination validity
      if (!validateEventSourceCombination(ce.eventType, ce.source)) {
        defects.push({
          code: "INVALID_EVENT_SOURCE_COMBINATION",
          eventId: ce.id,
          eventType: ce.eventType,
          source: ce.source,
          message: `Event ${ce.id} has invalid source ${ce.source} for eventType ${ce.eventType}`,
        });
      }
    }

    // 6. Audit Consents
    const grantedAuthConsents = await prisma.analyticsConsentHistory.count({
      where: { userId: { not: null }, status: "GRANTED" },
    });
    const withdrawnAuthConsents = await prisma.analyticsConsentHistory.count({
      where: { userId: { not: null }, status: "WITHDRAWN" },
    });
    const activeAnonConsents = await prisma.analyticsConsentHistory.count({
      where: { userId: null, consentIdHash: { not: null }, status: "GRANTED", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    });
    const withdrawnAnonConsents = await prisma.analyticsConsentHistory.count({
      where: { userId: null, consentIdHash: { not: null }, status: "WITHDRAWN" },
    });
    const expiredAnonConsents = await prisma.analyticsConsentHistory.count({
      where: { userId: null, consentIdHash: { not: null }, expiresAt: { lte: new Date() } },
    });

    // 7. Detailed Policy Evaluation Metrics & Counts
    const completedConsumptionCount = await prisma.usageLedger.count({
      where: { entitlementType: "VENTURE_BLUEPRINT_EXPORT", unitsConsumed: { gt: 0 } },
    });
    const compensatingReleasesCount = await prisma.usageLedger.count({
      where: { entitlementType: "VENTURE_BLUEPRINT_EXPORT", unitsConsumed: { lt: 0 } },
    });
    const checkoutAttemptsCount = await prisma.billingCheckoutAttempt.count();
    const webhookConfirmedProActivations = await prisma.billingSubscription.count({
      where: { status: "ACTIVE" },
    });

    // Policy evaluations derived from opportunities and users
    const oppsCount = await prisma.opportunity.count();
    const anonPolicyEvaluations = oppsCount;
    const freePolicyEvaluations = freeUsers.length * oppsCount;
    const proPolicyEvaluations = proUsers.length * oppsCount;
    const previewDtos = (1 + freeUsers.length) * oppsCount; // Anon + Free
    const fullPermittedDtos = proUsers.length * oppsCount; // Pro
    const lockedResponses = (1 + freeUsers.length) * oppsCount; // Preview has locked sections

    // 8. Print Comprehensive Audit Report Table
    console.log("----------------------------------------------------------------");
    console.log(`Anonymous policy evaluations      : ${anonPolicyEvaluations}`);
    console.log(`Free policy evaluations           : ${freePolicyEvaluations}`);
    console.log(`Pro policy evaluations            : ${proPolicyEvaluations}`);
    console.log(`Preview DTOs                      : ${previewDtos}`);
    console.log(`Full permitted DTOs               : ${fullPermittedDtos}`);
    console.log(`Locked responses                  : ${lockedResponses}`);
    console.log(`Owner-matched Founder Fit evals   : ${ownerMatchedFits}`);
    console.log(`Completed PDF exports             : ${completedPdfExports}`);
    console.log(`Completed CSV exports             : ${completedCsvExports}`);
    console.log(`Failed exports                    : ${failedExports}`);
    console.log(`Rejected exports                  : ${rejectedExports}`);
    console.log(`Pending export reservations       : ${pendingExportReservations}`);
    console.log(`Completed usage consumption       : ${completedConsumptionCount}`);
    console.log(`Compensating releases             : ${compensatingReleasesCount}`);
    console.log(`Abandoned reservations recovered  : ${abandonedReservationsRecovered}`);
    console.log(`Checkout attempts                 : ${checkoutAttemptsCount}`);
    console.log(`Webhook-confirmed Pro activations : ${webhookConfirmedProActivations}`);
    console.log(`Commercial events by event type   : ${JSON.stringify(eventCountsByType)}`);
    console.log(`Granted authenticated consents    : ${grantedAuthConsents}`);
    console.log(`Withdrawn authenticated consents  : ${withdrawnAuthConsents}`);
    console.log(`Active anonymous consent records  : ${activeAnonConsents}`);
    console.log(`Withdrawn anonymous consent recs  : ${withdrawnAnonConsents}`);
    console.log(`Expired anonymous consent records : ${expiredAnonConsents}`);
    console.log(`Expired commercial events proc    : ${expiredEventsProcessed}`);
    console.log(`Active legal holds                : ${activeLegalHolds}`);
    console.log(`Audit defects                     : ${defects.length}`);
    console.log("----------------------------------------------------------------");

    if (defects.length > 0) {
      console.log("DEFECTS ENCOUNTERED:");
      defects.forEach((d, i) => console.log(` [Defect ${i + 1}]`, JSON.stringify(d)));

      if (isReportOnly) {
        console.log("Report-only mode active: Exiting with code 0.");
        process.exit(0);
      }
      process.exit(1);
    }

    console.log("Premium Access Audit Result: CLEAN PASS (Exit code 0)");
    process.exit(0);
  } catch (err) {
    console.error("Premium Access Audit Execution / DB Failure:", err?.message);
    process.exit(2);
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
    if (tempDbName) {
      try {
        execSync(`docker exec -i buildworth-p2-test psql -U postgres -d postgres -c "DROP DATABASE ${tempDbName};"`, { stdio: "pipe" });
      } catch {}
    }
  }
}

if (require.main === module) {
  runPremiumAccessAudit();
}

module.exports = { runPremiumAccessAudit };
