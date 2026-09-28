import { timingSafeEqualStr } from "./manual-staging-ingestion.js";

export interface VerifyCronAuthOptions {
  authorizationHeader?: string | null;
  hasQueryParamsSecret?: boolean;
  serverCronSecret?: string | null;
  userAgent?: string | null;
  vercelCronHeader?: string | null;
  vercelCronSchedule?: string | null;
}

export interface VerifyCronAuthResult {
  authorized: boolean;
  statusCode: 200 | 401 | 403;
  error?: string;
  diagnostics?: {
    hasVercelCronHeader: boolean;
    cronSchedule: string | null;
  };
}

/**
 * Strict authentication validator for scheduled discovery crons.
 * Enforces:
 * 1. Immediate 403 rejection if secrets are passed in query params.
 * 2. Fail-closed (401) if server CRON_SECRET is missing or < 16 chars.
 * 3. Fail-closed (401) if Authorization header is missing or not a Bearer token.
 * 4. Fail-closed (401) if Bearer token does not match CRON_SECRET in constant-time.
 * 5. Attacker-controlled headers (User-Agent, x-vercel-cron, x-vercel-cron-schedule) are ONLY
 *    collected as diagnostic metadata AFTER valid Bearer authentication, and NEVER grant access alone.
 * 6. No secret values or comparison details are leaked in responses or logs.
 */
export function verifyCronAuthorization(options: VerifyCronAuthOptions): VerifyCronAuthResult {
  if (options.hasQueryParamsSecret) {
    return {
      authorized: false,
      statusCode: 403,
      error: "Query secrets are strictly forbidden",
    };
  }

  const cronSecret = options.serverCronSecret;
  if (!cronSecret || cronSecret.trim().length < 16) {
    return {
      authorized: false,
      statusCode: 401,
      error: "Unauthorized: Valid Cron authentication required",
    };
  }

  const authHeader = options.authorizationHeader;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      authorized: false,
      statusCode: 401,
      error: "Unauthorized: Valid Cron authentication required",
    };
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!timingSafeEqualStr(token, cronSecret)) {
    return {
      authorized: false,
      statusCode: 401,
      error: "Unauthorized: Valid Cron authentication required",
    };
  }

  const hasVercelCronHeader = options.vercelCronHeader === "1";
  const cronSchedule = options.vercelCronSchedule || null;

  return {
    authorized: true,
    statusCode: 200,
    diagnostics: {
      hasVercelCronHeader,
      cronSchedule,
    },
  };
}

/**
 * Generates a deterministic, shared idempotency key for a given UTC date.
 * Guarantees that both Vercel Cron (00:00 UTC) and the GitHub Actions fallback (01:15 UTC),
 * or manual recovery on the same day, resolve to the exact same idempotency key.
 */
export function getDailyCronIdempotencyKey(date: Date = new Date()): string {
  const utcDateStr = date.toISOString().slice(0, 10);
  return `cron-prod-ingest-${utcDateStr}`;
}

