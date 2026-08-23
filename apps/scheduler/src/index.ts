import { logger } from "@buildworth/observability";

export const SCHEDULED_TASKS = [
  {
    name: "hourly_source_ingestion",
    cron: "0 * * * *",
    description: "Ingest signals from Hacker News, Reddit, GitHub, Product Hunt",
  },
  {
    name: "daily_problem_clustering",
    cron: "0 2 * * *",
    description: "Run pgvector clustering and synthesize new problem spaces",
  },
  {
    name: "daily_spend_ledger_reset",
    cron: "0 0 * * *",
    description: "Reset daily AI spend ledger allocations",
  },
];

async function runScheduler() {
  logger.info("BuildWorth Ingestion Cron Scheduler initialized.", {
    tasksCount: SCHEDULED_TASKS.length,
  });

  process.on("SIGINT", () => {
    logger.info("Scheduler gracefully shutting down...");
    process.exit(0);
  });
}

if (process.argv[1] && process.argv[1].endsWith("index.js")) {
  runScheduler().catch((err) => {
    logger.error("Fatal scheduler error", err);
    process.exit(1);
  });
}
