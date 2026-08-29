/**
 * BuildWorth Phase 4D GDPR-Aligned Privacy-Safe Commercial Events Specification
 */

export type CommercialEventType =
  | "PAYWALL_VIEWED"
  | "UPGRADE_CTA_CLICKED"
  | "CHECKOUT_CREATED"
  | "CHECKOUT_CANCELLED"
  | "CHECKOUT_COMPLETED"
  | "ENTITLEMENT_ACTIVATED"
  | "EXPORT_REQUESTED"
  | "EXPORT_COMPLETED"
  | "EXPORT_REJECTED";

export type CommercialEventSource =
  | "SERVER_PAYWALL_BOUNDARY"
  | "PRICING_PAGE"
  | "CHECKOUT_SERVICE"
  | "WEBHOOK_PROCESSOR"
  | "EXPORT_SERVICE"
  | "OPPORTUNITY_DOSSIER";

export type CommercialRetentionClass =
  | "STANDARD_ANALYTICS"
  | "TRANSACTIONAL_LIFECYCLE"
  | "SECURITY_DIAGNOSTIC";

export type CommercialPurposeCode =
  | "PRODUCT_CONVERSION_ANALYTICS"
  | "CONTRACT_AND_BILLING_LIFECYCLE"
  | "SERVICE_DELIVERY_AND_SECURITY";

export type CommercialLawfulBasis =
  | "CONSENT"
  | "CONTRACT"
  | "LEGAL_OBLIGATION"
  | "LEGITIMATE_INTEREST";

export type AnalyticsConsentStatus = "GRANTED" | "WITHDRAWN";

/**
 * Strict per-event allowed metadata keys.
 * Notice: raw requestId, returnTo, and sensitive identifiers are strictly excluded.
 */
export const ALLOWED_EVENT_METADATA_KEYS: Record<CommercialEventType, string[]> = {
  PAYWALL_VIEWED: [
    "opportunitySlug",
    "lockedSection",
    "requiredTier",
    "userTier",
    "triggerLocation",
  ],
  UPGRADE_CTA_CLICKED: [
    "opportunitySlug",
    "sourceSection",
    "targetPlanCode",
    "billingInterval",
    "catalogKey",
    "userTier",
  ],
  CHECKOUT_CREATED: [
    "planCode",
    "billingInterval",
    "currency",
    "amountCents",
    "catalogKey",
  ],
  CHECKOUT_CANCELLED: [
    "planCode",
    "billingInterval",
    "catalogKey",
  ],
  CHECKOUT_COMPLETED: [
    "planCode",
    "billingInterval",
    "catalogKey",
    "stripeEventId",
  ],
  ENTITLEMENT_ACTIVATED: [
    "tier",
    "planCode",
    "billingInterval",
    "subscriptionStatus",
    "periodEnd",
    "stripeEventId",
  ],
  EXPORT_REQUESTED: [
    "opportunitySlug",
    "format",
    "quotaPeriodKey",
    "userTier",
  ],
  EXPORT_COMPLETED: [
    "opportunitySlug",
    "format",
    "quotaPeriodKey",
    "byteSize",
    "contentHash",
    "durationMs",
  ],
  EXPORT_REJECTED: [
    "opportunitySlug",
    "format",
    "quotaPeriodKey",
    "failureCode",
    "userTier",
  ],
};

/**
 * Forbidden keys that must NEVER be persisted in commercial event metadata.
 */
export const FORBIDDEN_METADATA_KEYS = [
  "requestId",
  "returnTo",
  "email",
  "name",
  "userName",
  "userEmail",
  "password",
  "token",
  "accessToken",
  "secret",
  "stripeSecretKey",
  "stripeWebhookSecret",
  "webhookSecret",
  "card",
  "cardNumber",
  "cvv",
  "cvc",
  "rawPayload",
  "payload",
  "ip",
  "ipAddress",
  "userAgent",
  "answers",
  "rawAnswers",
  "founderProfileAnswers",
  "unsubscribeToken",
  "authHeader",
  "cookie",
];

export const MAX_METADATA_KEY_COUNT = 20;
export const MAX_METADATA_DEPTH = 3;
export const MAX_METADATA_SERIALIZED_BYTES = 2048; // 2KB max per event

export interface CommercialEventPayload {
  eventType: CommercialEventType;
  deduplicationKey: string;
  userId?: string | null;
  opportunityId?: string | null;
  checkoutAttemptId?: string | null;
  exportId?: string | null;
  source: CommercialEventSource;
  metadata: Record<string, any>;
  signedAnonymousConsentToken?: string;
  retentionExpiresAt?: Date;
  retentionPolicyVersion?: string;
  occurredAt?: Date;
}

export interface PrivacyRetentionDTO {
  version: string;
  dpoContact: string;
  jurisdiction: string;
  purposes: Array<{
    purposeCode: CommercialPurposeCode;
    description: string;
    lawfulBasis: CommercialLawfulBasis[];
    collectedDataCategories: string[];
    retentionPolicy: string;
    retentionDaysConfigKey: string;
    applicableRights: string[];
  }>;
}
