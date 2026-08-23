export type AdapterType = "HACKERNEWS_API" | "REDDIT_OAUTH" | "GITHUB_REST" | "PRODUCTHUNT_GRAPHQL";
export type SourceAccessMethod = "API" | "OAUTH_API" | "GRAPHQL" | "RSS";

export interface RawIngestSignal {
  externalId: string;
  sourceKey: string;
  sourceUrl: string;
  authorFingerprint?: string;
  title?: string;
  rawContent: string;
  publishedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface SanitizedSignal {
  externalId: string;
  sourceKey: string;
  canonicalUrl: string;
  sanitizedTitle?: string;
  sanitizedExcerpt: string;
  contentHash: string;
  publishedAt: Date;
  metadata: Record<string, unknown>;
  authorFingerprint?: string;
}

export interface SourceHealthStatus {
  sourceKey: string;
  name: string;
  adapterType: AdapterType;
  accessMethod: SourceAccessMethod;
  rateLimitPerMinute: number;
  isEnabled: boolean;
  termsNotes: string;
  attributionRequired: boolean;
  lastRunStatus?: "SUCCESS" | "FAILED" | "RUNNING";
  lastRunSignalsCount?: number;
  lastRunAt?: Date;
  errorMessage?: string;
}

export interface IngestionResult {
  sourceKey: string;
  totalFetched: number;
  totalIngested: number;
  totalDuplicates: number;
  totalRejected: number;
  errors: string[];
  signals: SanitizedSignal[];
}
