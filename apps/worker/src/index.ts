import { logger } from "@buildworth/observability";
import { executeIntelligencePipeline } from "@buildworth/opportunity-engine";

export type JobType =
  | "INGEST_SOURCE_JOB"
  | "PROCESS_SIGNALS_JOB"
  | "CLUSTER_PROBLEM_SPACES_JOB"
  | "SYNTHESIZE_OPPORTUNITY_JOB"
  | "RUN_FULL_PIPELINE_JOB";

export interface QueueJob<T = unknown> {
  id: string;
  type: JobType;
  payload: T;
  attempts: number;
}

export async function processQueueJob(job: QueueJob): Promise<void> {
  logger.info(`Processing job ${job.id} of type ${job.type}...`);
  switch (job.type) {
    case "RUN_FULL_PIPELINE_JOB": {
      const summary = await executeIntelligencePipeline();
      logger.info(
        `Pipeline job complete: synthesized ${summary.opportunitiesSynthesized.length} opportunities.`,
      );
      break;
    }
    default:
      logger.info(`Handled job type: ${job.type}`);
  }
}

async function runWorker() {
  logger.info("BuildWorth Job Worker active. Ready to process ingestion and synthesis tasks.");

  // Sample self-test job dispatch
  await processQueueJob({
    id: "job-initial-sync",
    type: "RUN_FULL_PIPELINE_JOB",
    payload: {},
    attempts: 1,
  });

  process.on("SIGINT", () => {
    logger.info("Worker gracefully shutting down...");
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    logger.info("Worker received SIGTERM...");
    process.exit(0);
  });
}

if (process.argv[1] && process.argv[1].endsWith("index.js")) {
  runWorker().catch((err) => {
    logger.error("Fatal worker error", err);
    process.exit(1);
  });
}
