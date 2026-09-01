import { prisma } from "./client.js";

export interface AuditResult {
  totalSources: number;
  unauditedSources: number;
  totalSignals: number;
  verifiedSignals: number;
  legacyUnclassifiedSignals: number;
  syntheticFixturesInProd: number;
  verifiedSignalsWithoutValidLinks: number;
  totalOpportunities: number;
  verifiedOpps: number;
  hypothesisOpps: number;
  opportunitiesWithMismatchedEvidence: number;
  unsupportedHighConfidenceOpps: number;
  unsafeOrMissingUrls: number;
  hasDefects: boolean;
  exitCode: number;
}

export async function auditEvidenceDataQuality(reportOnly: boolean = false): Promise<AuditResult> {
  if (!process.env.DATABASE_URL) {
    console.error("[FATAL] Missing required environment variable: DATABASE_URL");
    process.exit(2);
  }
  console.log("=== BuildWorth Data Quality & Evidence Audit ===");
  if (reportOnly) {
    console.log("Mode: --report-only (Defects will not trigger non-zero exit code)");
  }

  let totalSources = 0;
  let unauditedSources = 0;
  let totalSignals = 0;
  let verifiedSignals = 0;
  let legacyUnclassifiedSignals = 0;
  let syntheticFixturesInProd = 0;
  let verifiedSignalsWithoutValidLinks = 0;
  let totalOpportunities = 0;
  let verifiedOpps = 0;
  let hypothesisOpps = 0;
  let opportunitiesWithMismatchedEvidence = 0;
  let unsupportedHighConfidenceOpps = 0;
  let unsafeOrMissingUrls = 0;

  try {
    totalSources = await prisma.source.count();
    unauditedSources = await prisma.source.count({
      where: { policyStatus: "UNKNOWN" },
    });

    totalSignals = await prisma.normalizedSignal.count();
    verifiedSignals = await prisma.normalizedSignal.count({
      where: { verificationStatus: "VERIFIED" },
    });
    legacyUnclassifiedSignals = await prisma.normalizedSignal.count({
      where: { evidenceOrigin: "LEGACY_UNCLASSIFIED" },
    });
    syntheticFixturesInProd = await prisma.normalizedSignal.count({
      where: { evidenceOrigin: "SYNTHETIC_FIXTURE" },
    });

    totalOpportunities = await prisma.opportunity.count();
    verifiedOpps = await prisma.opportunity.count({
      where: { publicationQualityStatus: "VERIFIED" },
    });
    hypothesisOpps = await prisma.opportunity.count({
      where: { publicationQualityStatus: "HYPOTHESIS" },
    });

    // Check verified signals without evidence links
    const allVerifiedSignals = await prisma.normalizedSignal.findMany({
      where: { verificationStatus: "VERIFIED" },
      include: { evidenceLinks: true },
    });
    for (const s of allVerifiedSignals) {
      if (!s.evidenceLinks || s.evidenceLinks.length === 0) {
        verifiedSignalsWithoutValidLinks++;
      }
    }

    // Check for unsupported high confidence scorecards
    const highConfidenceScorecards = await prisma.scorecard.findMany({
      where: {
        evidenceConfidenceScore: { gt: 40 },
      },
      include: {
        opportunity: {
          include: {
            evidenceLinks: {
              include: { normalizedSignal: true },
            },
          },
        },
      },
    });

    for (const sc of highConfidenceScorecards) {
      const qualifyingLinks = sc.opportunity.evidenceLinks.filter(
        (l) =>
          l.normalizedSignal.verificationStatus === "VERIFIED" &&
          l.normalizedSignal.evidenceOrigin !== "LEGACY_UNCLASSIFIED" &&
          l.normalizedSignal.evidenceOrigin !== "SYNTHETIC_FIXTURE",
      );
      if (qualifyingLinks.length === 0) {
        unsupportedHighConfidenceOpps++;
      }
    }

    // Check for missing/unsafe URLs on verified signals
    const signals = await prisma.normalizedSignal.findMany();
    for (const sig of signals) {
      if (sig.verificationStatus === "VERIFIED") {
        if (
          !sig.canonicalUrl ||
          (!sig.canonicalUrl.startsWith("http://") && !sig.canonicalUrl.startsWith("https://"))
        ) {
          unsafeOrMissingUrls++;
        }
      }
    }
  } catch (err: any) {
    console.error("Fatal Database/Configuration Error during audit:", err.message || err);
    return {
      totalSources: 0,
      unauditedSources: 0,
      totalSignals: 0,
      verifiedSignals: 0,
      legacyUnclassifiedSignals: 0,
      syntheticFixturesInProd: 0,
      verifiedSignalsWithoutValidLinks: 0,
      totalOpportunities: 0,
      verifiedOpps: 0,
      hypothesisOpps: 0,
      opportunitiesWithMismatchedEvidence: 0,
      unsupportedHighConfidenceOpps: 0,
      unsafeOrMissingUrls: 0,
      hasDefects: true,
      exitCode: 2, // Exit code 2 for db/config errors
    };
  }

  console.log("1. Legacy-Unclassified Signals:", legacyUnclassifiedSignals);
  console.log("2. Synthetic Fixtures in Production Data:", syntheticFixturesInProd);
  console.log(
    "3. Verified Signals Without Valid Evidence Links:",
    verifiedSignalsWithoutValidLinks,
  );
  console.log(
    "4. Opportunities With Mismatched Evidence Counts:",
    opportunitiesWithMismatchedEvidence,
  );
  console.log(
    "5. Unsupported High-Confidence Scores in Production:",
    unsupportedHighConfidenceOpps,
  );
  console.log("6. Unsafe or Missing URLs in Production Evidence:", unsafeOrMissingUrls);
  console.log(
    "7. Total Sources Audited:",
    totalSources,
    "('UNKNOWN' policy status:",
    unauditedSources,
    ")",
  );
  console.log(
    "8. Total Opportunities:",
    totalOpportunities,
    "(VERIFIED:",
    verifiedOpps,
    ", HYPOTHESIS:",
    hypothesisOpps,
    ")",
  );

  const hasDefects =
    legacyUnclassifiedSignals > 0 ||
    syntheticFixturesInProd > 0 ||
    verifiedSignalsWithoutValidLinks > 0 ||
    opportunitiesWithMismatchedEvidence > 0 ||
    unsupportedHighConfidenceOpps > 0 ||
    unsafeOrMissingUrls > 0;

  let exitCode = 0;
  if (hasDefects) {
    console.log("=== Audit Status: DEFECTS DETECTED (Quarantine or Data Fix Required) ===");
    exitCode = reportOnly ? 0 : 1;
  } else {
    console.log("=== Audit Status: CLEAN PASS (All items verified, 0 defects) ===");
    exitCode = 0;
  }

  return {
    totalSources,
    unauditedSources,
    totalSignals,
    verifiedSignals,
    legacyUnclassifiedSignals,
    syntheticFixturesInProd,
    verifiedSignalsWithoutValidLinks,
    totalOpportunities,
    verifiedOpps,
    hypothesisOpps,
    opportunitiesWithMismatchedEvidence,
    unsupportedHighConfidenceOpps,
    unsafeOrMissingUrls,
    hasDefects,
    exitCode,
  };
}

if (process.argv[1] && process.argv[1].endsWith("audit-script.js")) {
  const isReportOnly = process.argv.includes("--report-only");
  auditEvidenceDataQuality(isReportOnly)
    .then((res) => {
      process.exitCode = res.exitCode;
    })
    .catch((err) => {
      console.error(err);
      process.exit(2);
    })
    .finally(async () => {
      try {
        await prisma.$disconnect();
      } catch {}
    });
}
