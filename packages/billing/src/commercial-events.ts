import crypto from "crypto";
import {
  CommercialEventType,
  CommercialEventPayload,
  CommercialRetentionClass,
  CommercialPurposeCode,
  CommercialLawfulBasis,
  PrivacyRetentionDTO,
  AnalyticsConsentStatus,
  ALLOWED_EVENT_METADATA_KEYS,
  FORBIDDEN_METADATA_KEYS,
  MAX_METADATA_KEY_COUNT,
  MAX_METADATA_DEPTH,
  MAX_METADATA_SERIALIZED_BYTES,
} from "@buildworth/shared";

/**
 * Server-authoritative mapping of event types to GDPR purpose code and lawful basis
 */
export interface EventPurposeMapping {
  purposeCode: CommercialPurposeCode;
  lawfulBasis: CommercialLawfulBasis;
  retentionClass: CommercialRetentionClass;
  configRetentionKey: string;
}

export function getEventPurposeMapping(eventType: CommercialEventType): EventPurposeMapping {
  switch (eventType) {
    case "PAYWALL_VIEWED":
    case "UPGRADE_CTA_CLICKED":
      return {
        purposeCode: "PRODUCT_CONVERSION_ANALYTICS",
        lawfulBasis: "CONSENT",
        retentionClass: "STANDARD_ANALYTICS",
        configRetentionKey: "COMMERCIAL_ANALYTICS_RETENTION_DAYS",
      };

    case "CHECKOUT_CREATED":
    case "CHECKOUT_CANCELLED":
    case "CHECKOUT_COMPLETED":
    case "ENTITLEMENT_ACTIVATED":
      return {
        purposeCode: "CONTRACT_AND_BILLING_LIFECYCLE",
        lawfulBasis: "CONTRACT",
        retentionClass: "TRANSACTIONAL_LIFECYCLE",
        configRetentionKey: "COMMERCIAL_TRANSACTION_RETENTION_DAYS",
      };

    case "EXPORT_REQUESTED":
    case "EXPORT_COMPLETED":
    case "EXPORT_REJECTED":
    default:
      return {
        purposeCode: "SERVICE_DELIVERY_AND_SECURITY",
        lawfulBasis: "CONTRACT",
        retentionClass: "SECURITY_DIAGNOSTIC",
        configRetentionKey: "COMMERCIAL_SECURITY_RETENTION_DAYS",
      };
  }
}

/**
 * Strict validation of EventType and Source combinations.
 */
export function validateEventSourceCombination(
  eventType: CommercialEventType,
  source: string,
): boolean {
  switch (eventType) {
    case "PAYWALL_VIEWED":
      return source === "SERVER_PAYWALL_BOUNDARY" || source === "OPPORTUNITY_DOSSIER";
    case "UPGRADE_CTA_CLICKED":
      return source === "PRICING_PAGE" || source === "OPPORTUNITY_DOSSIER";
    case "CHECKOUT_CREATED":
    case "CHECKOUT_CANCELLED":
      return source === "CHECKOUT_SERVICE";
    case "CHECKOUT_COMPLETED":
    case "ENTITLEMENT_ACTIVATED":
      return source === "WEBHOOK_PROCESSOR";
    case "EXPORT_REQUESTED":
    case "EXPORT_COMPLETED":
    case "EXPORT_REJECTED":
      return source === "EXPORT_SERVICE";
    default:
      return false;
  }
}

/**
 * Resolves retention days from server configuration without invented production fallback values.
 * Returns null if unconfigured in production.
 */
export function getRetentionDaysForConfigKey(configKey: string): number | null {
  const raw = process.env[configKey];
  if (raw !== undefined && raw !== null && raw.trim() !== "") {
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  // In non-production environments (test/development), provide explicit deterministic test examples
  if (process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development") {
    switch (configKey) {
      case "COMMERCIAL_ANALYTICS_RETENTION_DAYS":
        return 90; // TEST_ONLY deterministic default
      case "COMMERCIAL_TRANSACTION_RETENTION_DAYS":
        return 730; // TEST_ONLY deterministic default (2 years)
      case "COMMERCIAL_SECURITY_RETENTION_DAYS":
        return 30; // TEST_ONLY deterministic default
      default:
        return 30;
    }
  }

  // In production, refuse invented fallback
  return null;
}

/**
 * Derives dedicated HMAC keys using crypto.hkdfSync with explicit salt and purpose-specific info.
 */
function deriveHkdfKey(purposeInfo: string): Buffer {
  const baseSecret = process.env.SESSION_SECRET || "buildworth_consent_signing_secret_dev";
  const salt = Buffer.from("buildworth_gdpr_key_derivation_salt_2026", "utf-8");
  const info = Buffer.from(purposeInfo, "utf-8");
  return Buffer.from(crypto.hkdfSync("sha256", Buffer.from(baseSecret, "utf-8"), salt, info, 32));
}

/**
 * Hashes a consent ID with SHA-256 for persistent database storage without storing the raw ID.
 */
export function hashConsentId(consentId: string): string {
  return crypto.createHash("sha256").update(consentId, "utf-8").digest("hex");
}

export interface AnonymousConsentTokenPayload {
  consentId: string;
  purpose: "PRODUCT_CONVERSION_ANALYTICS";
  policyVersion: string;
  issuedAt: number; // Unix seconds
  expiresAt: number; // Unix seconds
  keyVersion: number;
}

/**
 * Consent System: Records or withdraws analytics consent in durable server-side history.
 */
export async function recordUserAnalyticsConsent(
  prisma: any,
  userId: string,
  status: AnalyticsConsentStatus,
  source: string = "CONSENT_BANNER",
  policyVersion: string = "1.0.0",
): Promise<{ id: string; status: AnalyticsConsentStatus }> {
  const now = new Date();
  const consent = await prisma.analyticsConsentHistory.create({
    data: {
      userId,
      purpose: "PRODUCT_CONVERSION_ANALYTICS",
      status,
      policyVersion,
      source,
      keyVersion: 1,
      grantedAt: status === "GRANTED" ? now : null,
      withdrawnAt: status === "WITHDRAWN" ? now : null,
    },
  });

  return { id: consent.id, status: consent.status };
}

/**
 * Consent System: Resolves whether user has active analytics consent on server.
 */
export async function hasUserActiveAnalyticsConsent(
  prisma: any,
  userId?: string | null,
): Promise<boolean> {
  if (!userId) return false;

  const latestConsent = await prisma.analyticsConsentHistory.findFirst({
    where: {
      userId,
      purpose: "PRODUCT_CONVERSION_ANALYTICS",
    },
    orderBy: { createdAt: "desc" },
  });

  return latestConsent?.status === "GRANTED";
}

/**
 * Anonymous Consent: Generates and persists a durable server-signed anonymous consent token.
 * Only the SHA-256 hash of consentId is stored in the database.
 */
export async function generateSignedAnonymousConsentToken(
  prisma: any,
  policyVersion: string = "1.0.0",
  validitySeconds: number = 86400 * 30, // 30 days
): Promise<string> {
  const key = deriveHkdfKey("ANONYMOUS_CONSENT_HMAC_KEY_V1");
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + validitySeconds;
  const consentId = crypto.randomBytes(16).toString("hex");
  const consentIdHash = hashConsentId(consentId);

  // Persist only hashed consentId in database
  await prisma.analyticsConsentHistory.create({
    data: {
      consentIdHash,
      purpose: "PRODUCT_CONVERSION_ANALYTICS",
      status: "GRANTED",
      policyVersion,
      source: "ANONYMOUS_CONSENT_BANNER",
      keyVersion: 1,
      expiresAt: new Date(expiresAt * 1000),
      grantedAt: new Date(now * 1000),
    },
  });

  const payload: AnonymousConsentTokenPayload = {
    consentId,
    purpose: "PRODUCT_CONVERSION_ANALYTICS",
    policyVersion,
    issuedAt: now,
    expiresAt,
    keyVersion: 1,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", key).update(payloadB64).digest("base64url");
  return `${payloadB64}.${signature}`;
}

/**
 * Anonymous Consent: Withdraws durable anonymous consent by hashing consentId and updating PostgreSQL.
 */
export async function withdrawSignedAnonymousConsentToken(
  prisma: any,
  token?: string | null,
): Promise<{ withdrawn: boolean; error?: string }> {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return { withdrawn: false, error: "INVALID_TOKEN_FORMAT" };
  }
  const parts = token.split(".");
  if (parts.length !== 2) return { withdrawn: false, error: "INVALID_TOKEN_PARTS" };
  const [payloadB64, signature] = parts;
  if (!payloadB64 || !signature) return { withdrawn: false, error: "INVALID_TOKEN_STRUCTURE" };

  const key = deriveHkdfKey("ANONYMOUS_CONSENT_HMAC_KEY_V1");
  const expectedSig = crypto.createHmac("sha256", key).update(payloadB64).digest("base64url");

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return { withdrawn: false, error: "SIGNATURE_VERIFICATION_FAILED" };
  }

  try {
    const payload: AnonymousConsentTokenPayload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf-8"),
    );
    const consentIdHash = hashConsentId(payload.consentId);

    const updated = await prisma.analyticsConsentHistory.updateMany({
      where: {
        consentIdHash,
        status: "GRANTED",
      },
      data: {
        status: "WITHDRAWN",
        withdrawnAt: new Date(),
      },
    });

    return { withdrawn: updated.count > 0 };
  } catch (err: any) {
    return { withdrawn: false, error: err?.message || "WITHDRAWAL_FAILED" };
  }
}

/**
 * Anonymous Consent: Verifies a server-signed anonymous consent token with constant-time HMAC comparison
 * and resolves the durable state in PostgreSQL by consentIdHash.
 */
export async function verifySignedAnonymousConsentToken(
  prisma: any,
  token?: string | null,
): Promise<boolean> {
  if (!token || typeof token !== "string" || !token.includes(".")) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, signature] = parts;
  if (!payloadB64 || !signature) return false;

  const key = deriveHkdfKey("ANONYMOUS_CONSENT_HMAC_KEY_V1");
  const expectedSig = crypto.createHmac("sha256", key).update(payloadB64).digest("base64url");

  // Constant-time signature verification
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return false;
  }

  try {
    const payload: AnonymousConsentTokenPayload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf-8"),
    );

    // Reject wrong purpose
    if (payload.purpose !== "PRODUCT_CONVERSION_ANALYTICS") return false;

    // Reject unsupported key version
    if (payload.keyVersion !== 1) return false;

    // Reject expired token by payload timestamp
    const now = Math.floor(Date.now() / 1000);
    if (!payload.expiresAt || payload.expiresAt < now) return false;

    // Token cannot contain any PII or identifiers
    if ((payload as any).userId || (payload as any).email || (payload as any).ip || (payload as any).deviceId) {
      return false;
    }

    // Resolve durable record in PostgreSQL using only consentIdHash
    const consentIdHash = hashConsentId(payload.consentId);
    const dbRecord = await prisma.analyticsConsentHistory.findUnique({
      where: { consentIdHash },
    });

    if (!dbRecord) return false;
    if (dbRecord.status !== "GRANTED") return false;
    if (dbRecord.withdrawnAt !== null) return false;
    if (dbRecord.expiresAt && dbRecord.expiresAt.getTime() < Date.now()) return false;
    if (dbRecord.purpose !== payload.purpose) return false;
    if (dbRecord.policyVersion !== payload.policyVersion) return false;
    if (dbRecord.keyVersion !== payload.keyVersion) return false;

    return true;
  } catch {
    return false;
  }
}

export interface InteractionTokenPayload {
  interactionId: string;
  eventType: "PAYWALL_VIEWED" | "UPGRADE_CTA_CLICKED";
  opportunitySlug: string;
  uiLocation: string;
  issuedAt: number;
  expiresAt: number;
  keyVersion: number;
}

/**
 * Server-Side Interaction Token Management:
 * Server issues opaque token bound completely to eventType, opportunitySlug, uiLocation, and timestamp.
 */
export function generateInteractionToken(params: {
  eventType: "PAYWALL_VIEWED" | "UPGRADE_CTA_CLICKED";
  opportunitySlug: string;
  uiLocation: string;
  validitySeconds?: number;
}): string {
  const key = deriveHkdfKey("INTERACTION_TOKEN_HMAC_KEY_V1");
  const now = Math.floor(Date.now() / 1000);
  const interactionId = crypto.randomBytes(16).toString("hex");
  const payload: InteractionTokenPayload = {
    interactionId,
    eventType: params.eventType,
    opportunitySlug: params.opportunitySlug,
    uiLocation: params.uiLocation,
    issuedAt: now,
    expiresAt: now + (params.validitySeconds || 3600), // Default 1 hour validity
    keyVersion: 1,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", key).update(payloadB64).digest("base64url");
  return `${payloadB64}.${signature}`;
}

export function verifyInteractionToken(
  token: string | undefined,
  expected: {
    eventType: "PAYWALL_VIEWED" | "UPGRADE_CTA_CLICKED";
    opportunitySlug: string;
    uiLocation: string;
  },
): { valid: boolean; interactionId?: string; error?: string } {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return { valid: false, error: "INVALID_TOKEN_FORMAT" };
  }
  const parts = token.split(".");
  if (parts.length !== 2) return { valid: false, error: "INVALID_TOKEN_PARTS" };
  const [payloadB64, signature] = parts;
  if (!payloadB64 || !signature) return { valid: false, error: "INVALID_TOKEN_STRUCTURE" };

  const key = deriveHkdfKey("INTERACTION_TOKEN_HMAC_KEY_V1");
  const expectedSig = crypto.createHmac("sha256", key).update(payloadB64).digest("base64url");
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return { valid: false, error: "TAMPERED_OR_FORGED_TOKEN" };
  }

  try {
    const payload: InteractionTokenPayload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf-8"),
    );
    if (payload.keyVersion !== 1) return { valid: false, error: "UNSUPPORTED_KEY_VERSION" };
    if (payload.eventType !== expected.eventType) return { valid: false, error: "EVENT_TYPE_MISMATCH" };
    if (payload.opportunitySlug !== expected.opportunitySlug) return { valid: false, error: "SLUG_MISMATCH" };
    if (payload.uiLocation !== expected.uiLocation) return { valid: false, error: "UI_LOCATION_MISMATCH" };
    if (payload.expiresAt && payload.expiresAt < Math.floor(Date.now() / 1000)) {
      return { valid: false, error: "TOKEN_EXPIRED" };
    }
    return { valid: true, interactionId: payload.interactionId };
  } catch {
    return { valid: false, error: "INVALID_PAYLOAD" };
  }
}

/**
 * Sanitizes and validates metadata strictly against the per-event allowlist,
 * depth limits, key count limits, and serialized byte size limit.
 * Strips any forbidden or unallowlisted keys (including raw requestId, returnTo, secrets, etc.).
 */
export function sanitizeEventMetadata(
  eventType: CommercialEventType,
  rawMetadata: Record<string, any> = {},
): Record<string, any> {
  if (!rawMetadata || typeof rawMetadata !== "object" || Array.isArray(rawMetadata)) {
    return {};
  }

  const allowedKeys = new Set(ALLOWED_EVENT_METADATA_KEYS[eventType] || []);
  const forbiddenKeys = new Set(FORBIDDEN_METADATA_KEYS.map((k) => k.toLowerCase()));

  const sanitized: Record<string, any> = {};
  let keyCount = 0;

  function processValue(val: any, currentDepth: number): any {
    if (val === null || val === undefined) return null;
    if (currentDepth > MAX_METADATA_DEPTH) return undefined;

    if (typeof val === "string") {
      return val.length > 256 ? val.substring(0, 256) : val;
    }
    if (typeof val === "number" || typeof val === "boolean") {
      return val;
    }
    if (val instanceof Date) {
      return val.toISOString();
    }
    if (Array.isArray(val)) {
      return val
        .slice(0, 10)
        .map((item) => processValue(item, currentDepth + 1))
        .filter((item) => item !== undefined);
    }
    if (typeof val === "object") {
      const nested: Record<string, any> = {};
      for (const [k, v] of Object.entries(val)) {
        if (forbiddenKeys.has(k.toLowerCase())) continue;
        const processed = processValue(v, currentDepth + 1);
        if (processed !== undefined) {
          nested[k] = processed;
        }
      }
      return nested;
    }
    return undefined;
  }

  for (const [key, value] of Object.entries(rawMetadata)) {
    if (keyCount >= MAX_METADATA_KEY_COUNT) break;

    // Check if key is strictly in the allowlist and not forbidden
    if (!allowedKeys.has(key) || forbiddenKeys.has(key.toLowerCase())) {
      continue;
    }

    const processed = processValue(value, 1);
    if (processed !== undefined) {
      sanitized[key] = processed;
      keyCount++;
    }
  }

  // Ensure total serialized size is bounded
  const serialized = JSON.stringify(sanitized);
  if (Buffer.byteLength(serialized, "utf-8") > MAX_METADATA_SERIALIZED_BYTES) {
    throw new Error(
      `METADATA_SIZE_EXCEEDED: Serialized metadata size ${Buffer.byteLength(serialized, "utf-8")} bytes exceeds ${MAX_METADATA_SERIALIZED_BYTES} byte limit.`,
    );
  }

  return sanitized;
}

/**
 * Server-authoritative recorder for GDPR-aligned commercial events.
 */
export async function recordCommercialEvent(
  prisma: any,
  payload: CommercialEventPayload,
): Promise<{ recorded: boolean; eventId?: string; error?: string; skippedConsent?: boolean }> {
  try {
    if (!payload.eventType || !payload.deduplicationKey || !payload.source) {
      return { recorded: false, error: "INVALID_COMMERCIAL_EVENT_PAYLOAD" };
    }

    // Validate EventType and Source combination strictly
    if (!validateEventSourceCombination(payload.eventType, payload.source)) {
      return {
        recorded: false,
        error: `INVALID_EVENT_SOURCE_COMBINATION: Event type ${payload.eventType} is not permitted from source ${payload.source}`,
      };
    }

    const mapping = getEventPurposeMapping(payload.eventType);
    const lawfulBasis: CommercialLawfulBasis = mapping.lawfulBasis;

    // Server-Authoritative Consent Check for PRODUCT_CONVERSION_ANALYTICS (PAYWALL_VIEWED, UPGRADE_CTA_CLICKED)
    // Note: LEGITIMATE_INTEREST runtime path is strictly disabled in Phase 4D.
    if (mapping.purposeCode === "PRODUCT_CONVERSION_ANALYTICS") {
      let isConsented = false;

      if (payload.userId) {
        // Authenticated: Query durable server-side consent history
        isConsented = await hasUserActiveAnalyticsConsent(prisma, payload.userId);
      } else {
        // Anonymous: Verify server-signed consent token against durable DB state
        isConsented = await verifySignedAnonymousConsentToken(prisma, payload.signedAnonymousConsentToken);
      }

      if (!isConsented) {
        return {
          recorded: false,
          skippedConsent: true,
          error: "ANALYTICS_CONSENT_REQUIRED: Event dropped due to missing or withdrawn analytics consent.",
        };
      }
    }

    // Resolve retention duration from configuration
    const retentionDays = getRetentionDaysForConfigKey(mapping.configRetentionKey);
    if (!retentionDays) {
      console.warn(`RETENTION_CONFIGURATION_REQUIRED: ${mapping.configRetentionKey} is unconfigured.`);
      if (mapping.retentionClass === "STANDARD_ANALYTICS") {
        return {
          recorded: false,
          error: "RETENTION_CONFIGURATION_REQUIRED: Refusing to persist unconfigured analytics event.",
        };
      }
    }

    const effectiveDays = retentionDays || 30;
    const occurredAt = payload.occurredAt || new Date();
    const retentionExpiresAt =
      payload.retentionExpiresAt ||
      new Date(occurredAt.getTime() + effectiveDays * 24 * 60 * 60 * 1000);
    const retentionPolicyVersion = payload.retentionPolicyVersion || "1.0.0";

    // Validate and sanitize metadata
    const sanitizedMetadata = sanitizeEventMetadata(payload.eventType, payload.metadata);

    // Cross-user integrity check
    if (payload.userId && payload.exportId) {
      const exp = await prisma.opportunityExport.findUnique({
        where: { id: payload.exportId },
        select: { userId: true },
      });
      if (exp && exp.userId !== payload.userId) {
        return { recorded: false, error: "CROSS_USER_EVENT_REJECTED" };
      }
    }

    if (payload.userId && payload.checkoutAttemptId) {
      const chk = await prisma.billingCheckoutAttempt.findUnique({
        where: { id: payload.checkoutAttemptId },
        select: { userId: true },
      });
      if (chk && chk.userId !== payload.userId) {
        return { recorded: false, error: "CROSS_USER_EVENT_REJECTED" };
      }
    }

    // Idempotent upsert/create via unique deduplicationKey
    const event = await prisma.commercialEvent.upsert({
      where: { deduplicationKey: payload.deduplicationKey },
      update: {}, // Immutable append-only
      create: {
        eventType: payload.eventType,
        deduplicationKey: payload.deduplicationKey,
        userId: payload.userId || null,
        opportunityId: payload.opportunityId || null,
        checkoutAttemptId: payload.checkoutAttemptId || null,
        exportId: payload.exportId || null,
        source: payload.source,
        purposeCode: mapping.purposeCode,
        lawfulBasis,
        metadata: sanitizedMetadata,
        retentionClass: mapping.retentionClass,
        retentionPolicyVersion,
        retentionExpiresAt,
        occurredAt,
      },
    });

    return { recorded: true, eventId: event.id };
  } catch (err: any) {
    console.error("Commercial Event Recording Warning:", err?.message || err);
    return { recorded: false, error: err?.message || "RECORDING_FAILED" };
  }
}

/**
 * Scheduled worker job: Reconciles expired commercial events according to GDPR retention policies.
 * Uses race-safe, bounded batch deletion to ensure multi-worker concurrency safety and legal hold enforcement.
 */
export async function reconcileCommercialEventRetention(
  prisma: any,
  options: { batchSize?: number; now?: Date } = {},
): Promise<{ deletedCount: number }> {
  const now = options.now || new Date();
  const batchSize = Math.min(options.batchSize || 100, 500);

  // PostgreSQL safe delete with subquery limit and legal hold exclusion
  // Ensures two concurrent workers process disjoint subsets without locking conflicts
  const deletedRows = await prisma.$queryRaw`
    WITH to_delete AS (
      SELECT id FROM "commercial_events"
      WHERE "retentionExpiresAt" <= ${now}
        AND ("legalHoldUntil" IS NULL OR "legalHoldUntil" <= ${now})
      ORDER BY "retentionExpiresAt" ASC
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    )
    DELETE FROM "commercial_events"
    WHERE id IN (SELECT id FROM to_delete)
    RETURNING id;
  `;

  const deletedCount = Array.isArray(deletedRows) ? deletedRows.length : 0;
  return { deletedCount };
}

/**
 * GDPR Data-Subject Rights: Access / Export User Commercial Events
 */
export async function getUserCommercialEventsExport(
  prisma: any,
  userId: string,
): Promise<Array<Record<string, any>>> {
  const events = await prisma.commercialEvent.findMany({
    where: { userId },
    select: {
      eventType: true,
      purposeCode: true,
      lawfulBasis: true,
      retentionClass: true,
      retentionExpiresAt: true,
      occurredAt: true,
      metadata: true,
    },
    orderBy: { occurredAt: "desc" },
  });

  return events;
}

/**
 * GDPR Data-Subject Rights: Erasure / Anonymization Request (Right to be Forgotten)
 */
export async function executeUserCommercialDataErasure(
  prisma: any,
  userId: string,
): Promise<{ deletedCount: number }> {
  // Delete all non-held events for the user
  const delRes = await prisma.commercialEvent.deleteMany({
    where: {
      userId,
      OR: [
        { legalHoldUntil: null },
        { legalHoldUntil: { lte: new Date() } },
      ],
    },
  });

  return { deletedCount: delRes.count };
}

/**
 * GDPR Data-Subject Rights: Restriction of Processing (Article 18)
 */
export async function restrictUserCommercialProcessing(
  prisma: any,
  userId: string,
): Promise<{ restrictedCount: number }> {
  const result = await prisma.commercialEvent.updateMany({
    where: { userId },
    data: { restrictedAt: new Date() },
  });

  return { restrictedCount: result.count };
}

/**
 * GDPR Data-Subject Rights: Place / Lift Legal Hold (Article 17(3)(e))
 */
export async function setCommercialEventLegalHold(
  prisma: any,
  eventId: string,
  holdUntil: Date | null,
  reasonCode?: string,
): Promise<void> {
  await prisma.commercialEvent.update({
    where: { id: eventId },
    data: {
      legalHoldUntil: holdUntil,
      legalHoldReasonCode: holdUntil ? reasonCode || "LEGAL_CLAIM_DEFENSE" : null,
    },
  });
}

/**
 * Public Privacy-Retention DTO for UI transparency section
 */
export function getPrivacyRetentionDTO(): PrivacyRetentionDTO {
  const isProd = process.env.NODE_ENV === "production" && !process.env.TEST_ENV;
  const configuredEmail = process.env.PRIVACY_CONTACT_EMAIL || (!isProd ? "privacy@buildworth.io" : "");
  const privacyContact = configuredEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredEmail) ? configuredEmail : null;
  const privacyContactConfigured = privacyContact !== null;

  return {
    version: "2026.1-GDPR",
    privacyContact,
    privacyContactConfigured,
    jurisdiction: "EU / Croatia (GDPR Art. 13/14)",
    purposes: [
      {
        purposeCode: "PRODUCT_CONVERSION_ANALYTICS",
        description: "Optimizing opportunity paywalls and user upgrade journeys.",
        lawfulBasis: ["CONSENT"],
        collectedDataCategories: ["Paywall interactions", "Upgrade CTA clicks", "Plan selection"],
        retentionPolicy: "Retained for up to 90 days, then permanently deleted.",
        retentionDaysConfigKey: "COMMERCIAL_ANALYTICS_RETENTION_DAYS",
        applicableRights: ["Access", "Erasure", "Consent Withdrawal"],
      },
      {
        purposeCode: "CONTRACT_AND_BILLING_LIFECYCLE",
        description: "Execution and verification of paid subscription contracts and checkouts.",
        lawfulBasis: ["CONTRACT", "LEGAL_OBLIGATION"],
        collectedDataCategories: ["Checkout status", "Selected billing interval", "Plan code"],
        retentionPolicy: "Retained for contract execution lifecycle, then deleted.",
        retentionDaysConfigKey: "COMMERCIAL_TRANSACTION_RETENTION_DAYS",
        applicableRights: ["Access", "Restriction", "Portability"],
      },
      {
        purposeCode: "SERVICE_DELIVERY_AND_SECURITY",
        description: "Enforcing export quota limits and security diagnostics against abuse.",
        lawfulBasis: ["CONTRACT", "LEGITIMATE_INTEREST"],
        collectedDataCategories: ["Export requests", "Format", "Byte size & hash", "Quota period"],
        retentionPolicy: "Retained for service delivery and security diagnostics, then deleted.",
        retentionDaysConfigKey: "COMMERCIAL_SECURITY_RETENTION_DAYS",
        applicableRights: ["Access", "Restriction"],
      },
    ],
  };
}
