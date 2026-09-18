import crypto from "crypto";
import { AuthoritativeRevisionSnapshot } from "./types.js";

export function canonicalizeSnapshot(snapshot: AuthoritativeRevisionSnapshot) {
  return {
    id: snapshot.id,
    oppId: snapshot.opportunityId,
    revNum: snapshot.revisionNumber,
    pubStatus: snapshot.publicationQualityStatus,
    confScore: Math.round(snapshot.evidenceConfidenceScore),
    oppScore: Math.round(snapshot.opportunityScore),
    rec: snapshot.decisionRecommendation,
    recReasons: [...(snapshot.decisionReasonCodes || [])].sort(),
    pricing: {
      cents: Math.round(snapshot.pricing?.baseMonthlyPriceCents || 0),
      cur: snapshot.pricing?.currency || "USD",
    },
    mvpCost: {
      min: Math.round(snapshot.mvpCost?.minBuildMinorCents || 0),
      max: Math.round(snapshot.mvpCost?.maxBuildMinorCents || 0),
      base: Math.round(snapshot.mvpCost?.baseBuildMinorCents || 0),
    },
    delivery: {
      min: Math.round(snapshot.deliveryTimeWeeks?.minWeeks || 0),
      max: Math.round(snapshot.deliveryTimeWeeks?.maxWeeks || 0),
      base: Math.round(snapshot.deliveryTimeWeeks?.baseWeeks || 0),
    },
    competitors: [...(snapshot.competitors || [])]
      .map((c) => ({
        name: (c.name || "").trim().toLowerCase(),
        type: c.competitorType,
        pricing: c.knownPricing || null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    risks: [...(snapshot.risks || [])]
      .map((r) => ({
        desc: (r.description || "").trim().toLowerCase(),
        cat: r.category,
        sev: r.severity,
        stat: r.status,
      }))
      .sort((a, b) => a.desc.localeCompare(b.desc)),
    signals: [...(snapshot.evidenceSignals || [])]
      .map((s) => ({
        id: s.id,
        type: s.signalType,
        pi: !!s.purchaseIntent,
        spend: s.spendingSignal || null,
        stat: s.verificationStatus,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}

export function computeCanonicalDiffHash(
  fromSnapshot: AuthoritativeRevisionSnapshot,
  toSnapshot: AuthoritativeRevisionSnapshot,
  diffVersion: string = "1.0.0",
): string {
  const canonicalFrom = canonicalizeSnapshot(fromSnapshot);
  const canonicalTo = canonicalizeSnapshot(toSnapshot);

  const payload = {
    version: diffVersion,
    from: canonicalFrom,
    to: canonicalTo,
  };

  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
