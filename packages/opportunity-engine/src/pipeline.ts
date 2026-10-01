import { sourceRegistry } from "@buildworth/source-connectors";
import { runAdapterIngestion } from "@buildworth/source-connectors";
import { defaultAI } from "@buildworth/ai";
import type { LLMProvider } from "@buildworth/ai";
import { classifySignal } from "./classifier.js";
import { extractSignalIntelligence } from "./extractor.js";
import { clusterSignals, ClusterCandidate } from "./clustering/cluster-manager.js";
import { synthesizeOpportunity, CompleteOpportunityBlueprint } from "./synthesizer.js";
import { logger } from "@buildworth/observability";

export interface PipelineExecutionSummary {
  sourcesScanned: number;
  totalSignalsIngested: number;
  classifiedSignalsCount: number;
  problemSpacesDiscovered: number;
  opportunitiesSynthesized: CompleteOpportunityBlueprint[];
  executionTimeMs: number;
}

/**
 * Executes the complete 20-step automated intelligence pipeline end-to-end.
 */
export async function executeIntelligencePipeline(
  aiProvider: LLMProvider = defaultAI,
): Promise<PipelineExecutionSummary> {
  const startTime = Date.now();
  logger.info("Executing BuildWorth 20-step opportunity discovery pipeline...");

  // Step 1 & 2: Ingest & Sanitize from all registered adapters
  const adapters = sourceRegistry.getAllAdapters();
  const existingHashes = new Set<string>();
  const allSanitizedSignals = [];

  for (const adapter of adapters) {
    const ingestRes = await runAdapterIngestion(adapter, existingHashes);
    allSanitizedSignals.push(...ingestRes.signals);
  }

  // Step 3 & 4: Classify & Extract intelligence
  const clusterCandidates: ClusterCandidate[] = [];

  for (const sig of allSanitizedSignals) {
    const classification = await classifySignal(
      aiProvider,
      sig.sanitizedExcerpt,
      sig.sanitizedTitle,
    );
    if (classification.signalType === "NOISE") continue;

    const extracted = await extractSignalIntelligence(
      aiProvider,
      sig.sanitizedExcerpt,
      sig.sanitizedTitle,
    );
    const embResult = await aiProvider.generateEmbedding(extracted.problemSummary);

    let detectedVertical = "Software Engineering & DevOps";
    const combinedText = `${extracted.workflowContext || ""} ${sig.sanitizedExcerpt || ""} ${sig.sanitizedTitle || ""}`.toLowerCase();
    if (combinedText.includes("devops") || combinedText.includes("compliance") || combinedText.includes("security") || combinedText.includes("soc2")) {
      detectedVertical = "DevOps & Compliance";
    } else if (combinedText.includes("data") || combinedText.includes("finops") || combinedText.includes("cloud cost") || combinedText.includes("warehouse")) {
      detectedVertical = "Data Engineering & FinOps";
    } else if (combinedText.includes("chip") || combinedText.includes("semiconductor") || combinedText.includes("hardware") || combinedText.includes("silicon")) {
      detectedVertical = "Semiconductors & DeepTech";
    } else if (combinedText.includes("battery") || combinedText.includes("energy") || combinedText.includes("cleantech") || combinedText.includes("climate")) {
      detectedVertical = "CleanTech & Climate";
    } else if (combinedText.includes("robot") || combinedText.includes("manufacturing") || combinedText.includes("automation")) {
      detectedVertical = "Robotics & Industrial Automation";
    } else if (combinedText.includes("fintech") || combinedText.includes("payment") || combinedText.includes("settlement")) {
      detectedVertical = "FinTech & Payments";
    }

    clusterCandidates.push({
      id: sig.externalId,
      problemSummary: extracted.problemSummary,
      vertical: detectedVertical,
      embedding: embResult.embedding,
    });
  }

  // Step 5: Semantic Clustering into Problem Spaces
  const clusters = clusterSignals(clusterCandidates, 0.75);

  // Step 6 & 7: Synthesize Complete 40-Attribute Opportunities & Run Critic
  const opportunities: CompleteOpportunityBlueprint[] = [];

  for (const cluster of clusters) {
    const blueprint = synthesizeOpportunity(cluster, cluster.signalIds.length);
    opportunities.push(blueprint);
  }

  const executionTimeMs = Date.now() - startTime;
  logger.info("Pipeline execution completed successfully.", {
    sources: adapters.length,
    signals: allSanitizedSignals.length,
    clusters: clusters.length,
    opportunities: opportunities.length,
    durationMs: executionTimeMs,
  });

  return {
    sourcesScanned: adapters.length,
    totalSignalsIngested: allSanitizedSignals.length,
    classifiedSignalsCount: clusterCandidates.length,
    problemSpacesDiscovered: clusters.length,
    opportunitiesSynthesized: opportunities,
    executionTimeMs,
  };
}
