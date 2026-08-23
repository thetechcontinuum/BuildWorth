import { BaseSourceAdapter } from "./adapters/base.js";
import { IngestionResult, SanitizedSignal } from "./types.js";
import { sanitizeRawContent } from "./sanitizer.js";
import { computeContentHash, canonicalizeUrl } from "./dedup.js";
import { logger } from "@buildworth/observability";

/**
 * Runs an ingestion batch for an adapter, applying sanitization and deduplication.
 */
export async function runAdapterIngestion(
  adapter: BaseSourceAdapter,
  existingHashes: Set<string> = new Set(),
): Promise<IngestionResult> {
  const result: IngestionResult = {
    sourceKey: adapter.sourceKey,
    totalFetched: 0,
    totalIngested: 0,
    totalDuplicates: 0,
    totalRejected: 0,
    errors: [],
    signals: [],
  };

  try {
    const rawSignals = await adapter.fetchSignals();
    result.totalFetched = rawSignals.length;

    for (const raw of rawSignals) {
      try {
        if (!raw.rawContent || raw.rawContent.trim().length < 10) {
          result.totalRejected++;
          continue;
        }

        const canonicalUrl = canonicalizeUrl(raw.sourceUrl);
        const sanitizedExcerpt = sanitizeRawContent(raw.rawContent);
        const contentHash = computeContentHash(sanitizedExcerpt, adapter.sourceKey);

        if (existingHashes.has(contentHash)) {
          result.totalDuplicates++;
          continue;
        }

        const sanitized: SanitizedSignal = {
          externalId: raw.externalId,
          sourceKey: adapter.sourceKey,
          canonicalUrl,
          sanitizedTitle: raw.title ? sanitizeRawContent(raw.title, 150) : undefined,
          sanitizedExcerpt,
          contentHash,
          publishedAt: raw.publishedAt,
          metadata: raw.metadata || {},
          authorFingerprint: raw.authorFingerprint,
        };

        result.signals.push(sanitized);
        result.totalIngested++;
        existingHashes.add(contentHash);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        result.errors.push(errorMsg);
        result.totalRejected++;
      }
    }

    logger.info(`Ingestion run complete for ${adapter.name}`, {
      fetched: result.totalFetched,
      ingested: result.totalIngested,
      duplicates: result.totalDuplicates,
      rejected: result.totalRejected,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    result.errors.push(errorMsg);
    logger.error(`Failed ingestion run for ${adapter.name}`, err as Error);
  }

  return result;
}
