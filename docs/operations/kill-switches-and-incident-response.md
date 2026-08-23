# Emergency Kill-Switches & Incident Response

## Kill Switch Subsystems

- `AUTO_PUBLISH`: Forces all synthesized opportunities into the manual review queue.
- `AI_GENERATION`: Halts all LLM and completion API calls immediately.
- `INGESTION`: Suspends all scheduled source polling and scrapers.
- `ALL`: Emergency global shutdown.

## Spend Ceiling Breach Response

When daily spend reaches $5.00 or monthly reaches $150.00, `AiSpendLedger` throws `KillSwitchError(AI_DAILY_SPEND_LIMIT_EXCEEDED)` and locks further LLM requests until manual budget reset.
