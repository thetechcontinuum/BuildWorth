import { logger } from "@buildworth/observability";
import { APP_CONSTANTS } from "@buildworth/config";

export const SCHEDULED_TASKS = [
  {
    name: "hourly_source_ingestion",
    cron: "0 * * * *",
    description: "Ingest signals from Hacker News, Reddit, GitHub, Product Hunt",
  },
  {
    name: "daily_opportunity_discovery",
    cron: APP_CONSTANTS.INGESTION_SCHEDULE.PRIMARY_CRON,
    description:
      "Execute daily 00:00 UTC AI market scan, pgvector clustering, and opportunity synthesis",
  },
  {
    name: "daily_spend_ledger_reset",
    cron: "0 0 * * *",
    description: "Reset daily AI spend ledger allocations",
  },
  {
    name: "minutely_notification_outbox_dispatch",
    cron: "* * * * *",
    description: "Poll and process pending notification outbox items with atomic row leasing",
  },
  {
    name: "morning_08am_radar_daily_digest",
    cron: "0 8 * * *",
    description: "Generate and queue daily Radar opportunity digest runs",
  },
  {
    name: "monday_08am_radar_weekly_digest",
    cron: "0 8 * * 1",
    description: "Generate and queue weekly Radar opportunity digest runs for Free and Pro users",
  },
  {
    name: "minutely_export_reservation_reconciliation",
    cron: "* * * * *",
    description: "Reconcile abandoned/expired PENDING opportunity export reservations and append compensating releases",
  },
  {
    name: "daily_03am_commercial_event_retention_reconciliation",
    cron: "0 3 * * *",
    description: "Reconcile expired GDPR commercial events: permanently delete expired analytics and irreversibly anonymize audit trails",
  },
];

async function runScheduler() {
  logger.info("BuildWorth Ingestion & Discovery Cron Scheduler initialized.", {
    tasksCount: SCHEDULED_TASKS.length,
    schedule: `${APP_CONSTANTS.INGESTION_SCHEDULE.PRIMARY_DESCRIPTION} (${APP_CONSTANTS.INGESTION_SCHEDULE.PRIMARY_CRON})`,
    fallback: `${APP_CONSTANTS.INGESTION_SCHEDULE.FALLBACK_DESCRIPTION} (${APP_CONSTANTS.INGESTION_SCHEDULE.FALLBACK_CRON})`,
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
