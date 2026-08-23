import { sourceRegistry } from "@buildworth/source-connectors";
import { runAdapterIngestion } from "@buildworth/source-connectors";
import { defaultAI } from "@buildworth/ai";
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
export async function executeIntelligencePipeline(): Promise<PipelineExecutionSummary> {
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
      defaultAI,
      sig.sanitizedExcerpt,
      sig.sanitizedTitle,
    );
    if (classification.signalType === "NOISE") continue;

    const extracted = await extractSignalIntelligence(
      defaultAI,
      sig.sanitizedExcerpt,
      sig.sanitizedTitle,
    );
    const embResult = await defaultAI.generateEmbedding(extracted.problemSummary);

    clusterCandidates.push({
      id: sig.externalId,
      problemSummary: extracted.problemSummary,
      vertical: extracted.workflowContext?.includes("DevOps")
        ? "DevOps & Compliance"
        : "Data Engineering & FinOps",
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
