export type RadarChangeDimension =
  | "PUBLICATION_STATUS"
  | "EVIDENCE_CONFIDENCE"
  | "DECISION_RECOMMENDATION"
  | "WILLINGNESS_TO_PAY"
  | "PRICING"
  | "MVP_COST"
  | "DELIVERY_TIME"
  | "COMPETITOR"
  | "CRITICAL_RISK"
  | "EVIDENCE_SIGNAL";

export type RadarChangeDirection = "POSITIVE" | "NEGATIVE" | "NEUTRAL";

export type RadarChangeSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type RadarAlertCadence = "INSTANT" | "DAILY_DIGEST" | "WEEKLY_DIGEST";

export interface DeterministicChangeItem {
  dimension: RadarChangeDimension;
  direction: RadarChangeDirection;
  severity: RadarChangeSeverity;
  reasonCode: string;
  sanitizedSummary: string;
  beforeValue: any;
  afterValue: any;
  numericDelta?: number | null;
  evidenceSignalIds?: string[];
}

export interface DeterministicDiffResult {
  fromRevisionId: string;
  toRevisionId: string;
  diffVersion: string;
  canonicalInputHash: string;
  overallSeverity: RadarChangeSeverity;
  items: DeterministicChangeItem[];
}

export interface AuthoritativeRevisionSnapshot {
  id: string;
  revisionNumber: number;
  opportunityId: string;
  publicationQualityStatus: string;
  evidenceConfidenceScore: number;
  opportunityScore: number;
  decisionRecommendation: string;
  decisionReasonCodes: string[];
  pricing: {
    baseMonthlyPriceCents: number;
    currency: string;
  };
  mvpCost: {
    minBuildMinorCents: number;
    maxBuildMinorCents: number;
    baseBuildMinorCents: number;
  };
  deliveryTimeWeeks: {
    minWeeks: number;
    maxWeeks: number;
    baseWeeks: number;
  };
  competitors: Array<{
    name: string;
    competitorType: string;
    knownPricing?: string | null;
  }>;
  risks: Array<{
    id?: string;
    category: string;
    severity: string;
    status: string;
    description: string;
  }>;
  evidenceSignals: Array<{
    id: string;
    signalType: string;
    purchaseIntent: boolean;
    spendingSignal?: string | null;
    verificationStatus: string;
    claimType?: string;
    relationshipType?: string;
  }>;
}

/**
 * Validates whether a given string is a recognized IANA timezone identifier.
 */
export function isValidIanaTimezone(tz: string): boolean {
  if (!tz || typeof tz !== "string") return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Calculates DST-safe next scheduled digest date at 08:00 AM in user's timezone.
 */
export function calculateNextDigestSchedule(
  cadence: "DAILY_DIGEST" | "WEEKLY_DIGEST",
  timezone: string = "UTC",
  baseDate: Date = new Date(),
): Date {
  const validTz = isValidIanaTimezone(timezone) ? timezone : "UTC";

  // Format parts in target timezone
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: validTz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    weekday: "short",
  });

  const parts = dtf.formatToParts(baseDate);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  const year = parseInt(partMap.year || "2026", 10);
  const month = parseInt(partMap.month || "1", 10); // 1-12
  const day = parseInt(partMap.day || "1", 10);
  const hour = parseInt(partMap.hour || "0", 10);

  if (cadence === "DAILY_DIGEST") {
    // Target: next day 08:00 AM local (or today if local hour < 8)
    const targetDay = hour < 8 ? day : day + 1;

    // Find UTC time by approximating and adjusting offset
    let approxUtc = new Date(Date.UTC(year, month - 1, targetDay, 8, 0, 0));
    // Determine offset in minutes for that moment
    const tzParts = dtf.formatToParts(approxUtc);
    const m: Record<string, string> = {};
    for (const p of tzParts) m[p.type] = p.value;
    const localH = parseInt(m.hour || "8", 10);
    const diffHours = localH - 8;
    return new Date(approxUtc.getTime() - diffHours * 3600000);
  } else {
    // Weekly Digest: Monday 08:00 AM
    const weekday = partMap.weekday || "Mon";
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const currentDayIdx = dayNames.indexOf(weekday);
    let daysUntilMonday = (1 - currentDayIdx + 7) % 7;
    if (daysUntilMonday === 0 && hour >= 8) {
      daysUntilMonday = 7;
    }
    const targetDay = day + daysUntilMonday;
    let approxUtc = new Date(Date.UTC(year, month - 1, targetDay, 8, 0, 0));
    const tzParts = dtf.formatToParts(approxUtc);
    const m: Record<string, string> = {};
    for (const p of tzParts) m[p.type] = p.value;
    const localH = parseInt(m.hour || "8", 10);
    const diffHours = localH - 8;
    return new Date(approxUtc.getTime() - diffHours * 3600000);
  }
}
