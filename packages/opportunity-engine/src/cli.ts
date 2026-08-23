import { getEnv } from "@buildworth/config";
import { executeIntelligencePipeline } from "./pipeline.js";
import { generateVentureDossierMarkdown } from "./dossier.js";
import { logger } from "@buildworth/observability";

async function main() {
  const env = getEnv();
  console.log("\n=======================================================");
  console.log("  BUILDWORTH: STARTUP OPPORTUNITY RADAR PIPELINE");
  console.log(`  AI Provider: ${env.AI_PROVIDER} (${env.AGNES_AI_BASE_URL})`);
  console.log("=======================================================\n");

  const summary = await executeIntelligencePipeline();

  console.log("\n--- Execution Summary ---");
  console.log(`Sources Scanned: ${summary.sourcesScanned}`);
  console.log(`Signals Ingested & Sanitized: ${summary.totalSignalsIngested}`);
  console.log(`Classified Candidates: ${summary.classifiedSignalsCount}`);
  console.log(`Problem Spaces Discovered: ${summary.problemSpacesDiscovered}`);
  console.log(`Synthesized 40-Attribute Opportunities: ${summary.opportunitiesSynthesized.length}`);
  console.log(`Duration: ${summary.executionTimeMs} ms\n`);

  for (const opp of summary.opportunitiesSynthesized) {
    console.log(`[DISCOVERED OPPORTUNITY] ${opp.title}`);
    console.log(`  - Opportunity Score: ${opp.scorecard.opportunityScore}/100`);
    console.log(`  - Evidence Confidence: ${opp.scorecard.evidenceConfidenceScore}%`);
    console.log(`  - Economic Buyer: ${opp.economicBuyer}`);
    console.log(`  - Plausible Pricing: ${opp.economics.plausibleMonthlyPriceRange.minMinor / 100} - ${opp.economics.plausibleMonthlyPriceRange.maxMinor / 100} USD/mo`);
    console.log(`  - Break-Even Customers: ${opp.economics.breakEvenCustomerCount.min} - ${opp.economics.breakEvenCustomerCount.max}`);
    console.log(`  - Critic Status: ${opp.criticReport.isApproved ? "APPROVED" : "REQUIRES_REVIEW"}\n`);

    const dossier = generateVentureDossierMarkdown(opp);
    console.log("Generated Venture Dossier Preview:");
    console.log(dossier.slice(0, 400) + "...\n");
  }

  console.log("=======================================================\n");
}

main().catch(err => {
  logger.error("Pipeline CLI execution failed", err);
  process.exit(1);
});
