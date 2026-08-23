import { logger } from "@buildworth/observability";

export const SCHEDULED_TASKS = [
  {
    name: "hourly_source_ingestion",
    cron: "0 * * * *",
    description: "Ingest signals from Hacker News, Reddit, GitHub, Product Hunt",
  },
  {
    name: "morning_06am_opportunity_discovery",
    cron: "0 6 * * *",
    description: "Execute 06:00 AM full AI market scan, pgvector clustering and new opportunity synthesis",
  },
  {
    name: "daily_spend_ledger_reset",
    cron: "0 0 * * *",
    description: "Reset daily AI spend ledger allocations",
  },
];

async function runScheduler() {
  logger.info("BuildWorth 06:00 AM Ingestion & Discovery Cron Scheduler initialized.", {
    tasksCount: SCHEDULED_TASKS.length,
    schedule: "Every morning at 06:00 AM (0 6 * * *)",
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
