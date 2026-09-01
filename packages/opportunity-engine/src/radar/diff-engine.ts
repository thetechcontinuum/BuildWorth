import {
  AuthoritativeRevisionSnapshot,
  DeterministicChangeItem,
  DeterministicDiffResult,
} from "./types.js";
import { computeCanonicalDiffHash } from "./canonical-input.js";
import { getHighestSeverity } from "./severity.js";

export function computeOpportunityRevisionDiff(
  fromSnapshot: AuthoritativeRevisionSnapshot,
  toSnapshot: AuthoritativeRevisionSnapshot,
  diffVersion: string = "1.0.0",
): DeterministicDiffResult {
  if (fromSnapshot.opportunityId !== toSnapshot.opportunityId) {
    throw new Error("DIFF_ENGINE_ERROR: Cannot diff revisions of different opportunities.");
  }

  const items: DeterministicChangeItem[] = [];

  // 1. Publication Status Transition
  if (fromSnapshot.publicationQualityStatus !== toSnapshot.publicationQualityStatus) {
    const fromStatus = fromSnapshot.publicationQualityStatus;
    const toStatus = toSnapshot.publicationQualityStatus;

    let severity: any = "MEDIUM";
    let direction: any = "NEUTRAL";

    if (fromStatus === "VERIFIED" && (toStatus === "STALE" || toStatus === "HYPOTHESIS")) {
      severity = "CRITICAL";
      direction = "NEGATIVE";
    } else if (toStatus === "VERIFIED") {
      severity = "HIGH";
      direction = "POSITIVE";
    } else if (toStatus === "STALE" || toStatus === "EVIDENCE_PENDING") {
      direction = "NEGATIVE";
      severity = "MEDIUM";
    }

    items.push({
      dimension: "PUBLICATION_STATUS",
      direction,
      severity,
      reasonCode: `STATUS_CHANGED_${toStatus}`,
      sanitizedSummary: `Publication status changed from ${fromStatus} to ${toStatus}.`,
      beforeValue: fromStatus,
      afterValue: toStatus,
    });
  }

  // 2. Evidence Confidence Delta
  const confDelta =
    Math.round(toSnapshot.evidenceConfidenceScore) -
    Math.round(fromSnapshot.evidenceConfidenceScore);
  const absConfDelta = Math.abs(confDelta);
  if (absConfDelta >= 5) {
    let severity: any = "MEDIUM";
    if (absConfDelta >= 15) {
      severity = "HIGH";
    }

    items.push({
      dimension: "EVIDENCE_CONFIDENCE",
      direction: confDelta > 0 ? "POSITIVE" : "NEGATIVE",
      severity,
      reasonCode: confDelta > 0 ? "CONFIDENCE_INCREASED" : "CONFIDENCE_DECREASED",
      sanitizedSummary: `Evidence confidence ${confDelta > 0 ? "increased" : "decreased"} by ${absConfDelta} points (${fromSnapshot.evidenceConfidenceScore}% → ${toSnapshot.evidenceConfidenceScore}%).`,
      beforeValue: fromSnapshot.evidenceConfidenceScore,
      afterValue: toSnapshot.evidenceConfidenceScore,
      numericDelta: confDelta,
    });
  }

  // 3. Decision Recommendation Transition
  if (fromSnapshot.decisionRecommendation !== toSnapshot.decisionRecommendation) {
    const fromRec = fromSnapshot.decisionRecommendation;
    const toRec = toSnapshot.decisionRecommendation;

    let severity: any = "HIGH";
    let direction: any = "NEUTRAL";

    if (fromRec === "BUILD_CANDIDATE" && (toRec === "REJECT" || toRec === "WEAK_OPPORTUNITY")) {
      severity = "CRITICAL";
      direction = "NEGATIVE";
    } else if (toRec === "BUILD_CANDIDATE") {
      severity = "HIGH";
      direction = "POSITIVE";
    } else if (toRec === "REJECT") {
      severity = "CRITICAL";
      direction = "NEGATIVE";
    }

    items.push({
      dimension: "DECISION_RECOMMENDATION",
      direction,
      severity,
      reasonCode: `DECISION_${toRec}`,
      sanitizedSummary: `Decision recommendation changed from ${fromRec} to ${toRec}.`,
      beforeValue: fromRec,
      afterValue: toRec,
    });
  }

  // 4. Willingness To Pay / Purchase Intent Evidence
  const fromWtpSignals = (fromSnapshot.evidenceSignals || []).filter(
    (s) =>
      (s.purchaseIntent || s.signalType === "WILLINGNESS_TO_PAY" || s.spendingSignal) &&
      s.verificationStatus === "VERIFIED",
  );
  const toWtpSignals = (toSnapshot.evidenceSignals || []).filter(
    (s) =>
      (s.purchaseIntent || s.signalType === "WILLINGNESS_TO_PAY" || s.spendingSignal) &&
      s.verificationStatus === "VERIFIED",
  );

  const fromWtpIds = new Set(fromWtpSignals.map((s) => s.id));
  const newWtpSignals = toWtpSignals.filter((s) => !fromWtpIds.has(s.id));

  if (newWtpSignals.length > 0) {
    items.push({
      dimension: "WILLINGNESS_TO_PAY",
      direction: "POSITIVE",
      severity: "HIGH",
      reasonCode: "NEW_WTP_EVIDENCE_VERIFIED",
      sanitizedSummary: `${newWtpSignals.length} newly verified willingness-to-pay signal(s) attached.`,
      beforeValue: { verifiedWtpCount: fromWtpSignals.length },
      afterValue: {
        verifiedWtpCount: toWtpSignals.length,
        addedSignalIds: newWtpSignals.map((s) => s.id),
      },
      numericDelta: newWtpSignals.length,
      evidenceSignalIds: newWtpSignals.map((s) => s.id),
    });
  }

  // 5. Pricing Changes
  const fromPrice = Math.round(fromSnapshot.pricing?.baseMonthlyPriceCents || 0);
  const toPrice = Math.round(toSnapshot.pricing?.baseMonthlyPriceCents || 0);
  if (fromPrice !== toPrice && fromPrice > 0 && toPrice > 0) {
    const priceDelta = toPrice - fromPrice;
    items.push({
      dimension: "PRICING",
      direction: priceDelta > 0 ? "POSITIVE" : "NEGATIVE",
      severity: "MEDIUM",
      reasonCode: "BASE_PRICING_UPDATED",
      sanitizedSummary: `Target monthly price updated from $${(fromPrice / 100).toFixed(0)} to $${(toPrice / 100).toFixed(0)}.`,
      beforeValue: {
        baseMonthlyPriceCents: fromPrice,
        currency: fromSnapshot.pricing?.currency || "USD",
      },
      afterValue: {
        baseMonthlyPriceCents: toPrice,
        currency: toSnapshot.pricing?.currency || "USD",
      },
      numericDelta: priceDelta,
    });
  }

  // 6. MVP Cost Changes
  const fromCostMin = Math.round(fromSnapshot.mvpCost?.minBuildMinorCents || 0);
  const toCostMin = Math.round(toSnapshot.mvpCost?.minBuildMinorCents || 0);
  const fromCostMax = Math.round(fromSnapshot.mvpCost?.maxBuildMinorCents || 0);
  const toCostMax = Math.round(toSnapshot.mvpCost?.maxBuildMinorCents || 0);

  if (fromCostMin !== toCostMin || fromCostMax !== toCostMax) {
    const delta = toCostMax - fromCostMax;
    items.push({
      dimension: "MVP_COST",
      direction: delta <= 0 ? "POSITIVE" : "NEGATIVE",
      severity: Math.abs(delta) > 500000 ? "HIGH" : "MEDIUM",
      reasonCode: "MVP_BUILD_COST_REVISED",
      sanitizedSummary: `Estimated MVP build cost revised from $${(fromCostMin / 100).toFixed(0)}-$${(fromCostMax / 100).toFixed(0)} to $${(toCostMin / 100).toFixed(0)}-$${(toCostMax / 100).toFixed(0)}.`,
      beforeValue: { minCents: fromCostMin, maxCents: fromCostMax },
      afterValue: { minCents: toCostMin, maxCents: toCostMax },
      numericDelta: delta,
    });
  }

  // 7. Delivery Time Changes
  const fromWeeks =
    fromSnapshot.deliveryTimeWeeks?.maxWeeks || fromSnapshot.deliveryTimeWeeks?.baseWeeks || 0;
  const toWeeks =
    toSnapshot.deliveryTimeWeeks?.maxWeeks || toSnapshot.deliveryTimeWeeks?.baseWeeks || 0;
  if (fromWeeks !== toWeeks && fromWeeks > 0 && toWeeks > 0) {
    const deltaWeeks = toWeeks - fromWeeks;
    items.push({
      dimension: "DELIVERY_TIME",
      direction: deltaWeeks <= 0 ? "POSITIVE" : "NEGATIVE",
      severity: "MEDIUM",
      reasonCode: "DELIVERY_TIMELINE_REVISED",
      sanitizedSummary: `Estimated delivery timeline changed from ${fromWeeks} weeks to ${toWeeks} weeks.`,
      beforeValue: fromWeeks,
      afterValue: toWeeks,
      numericDelta: deltaWeeks,
    });
  }

  // 8. Competitors Added or Removed
  const fromCompsMap = new Map(
    (fromSnapshot.competitors || []).map((c) => [
      (c.name || "").trim().toLowerCase(),
      (c.name || "").trim(),
    ]),
  );
  const toCompsMap = new Map(
    (toSnapshot.competitors || []).map((c) => [
      (c.name || "").trim().toLowerCase(),
      (c.name || "").trim(),
    ]),
  );

  const addedComps = [...toCompsMap.keys()]
    .filter((k) => k && !fromCompsMap.has(k))
    .map((k) => toCompsMap.get(k)!);
  const removedComps = [...fromCompsMap.keys()]
    .filter((k) => k && !toCompsMap.has(k))
    .map((k) => fromCompsMap.get(k)!);

  if (addedComps.length > 0 || removedComps.length > 0) {
    items.push({
      dimension: "COMPETITOR",
      direction: addedComps.length > 0 ? "NEGATIVE" : "POSITIVE",
      severity: "MEDIUM",
      reasonCode: addedComps.length > 0 ? "COMPETITOR_ADDED" : "COMPETITOR_REMOVED",
      sanitizedSummary:
        addedComps.length > 0
          ? `New market competitor(s) identified: ${addedComps.slice(0, 3).join(", ")}.`
          : `Competitor(s) marked inactive or removed: ${removedComps.slice(0, 3).join(", ")}.`,
      beforeValue: [...fromCompsMap.values()],
      afterValue: [...toCompsMap.values()],
    });
  }

  // 9. Critical Risks (Added, Escalated, or Mitigated)
  const fromCritRisks = (fromSnapshot.risks || []).filter(
    (r) => r.severity === "CRITICAL" && r.status === "IDENTIFIED",
  );
  const toCritRisks = (toSnapshot.risks || []).filter(
    (r) => r.severity === "CRITICAL" && r.status === "IDENTIFIED",
  );

  const fromCritDescs = new Set(
    fromCritRisks.map((r) => (r.description || "").trim().toLowerCase()),
  );
  const toCritDescs = new Set(toCritRisks.map((r) => (r.description || "").trim().toLowerCase()));

  const newCrit = [...toCritDescs].filter((d) => d && !fromCritDescs.has(d));
  const mitigatedCrit = [...fromCritDescs].filter((d) => d && !toCritDescs.has(d));

  if (newCrit.length > 0) {
    items.push({
      dimension: "CRITICAL_RISK",
      direction: "NEGATIVE",
      severity: "CRITICAL",
      reasonCode: "CRITICAL_RISK_IDENTIFIED",
      sanitizedSummary: `New unresolved critical risk identified: "${newCrit[0]?.slice(0, 80)}...".`,
      beforeValue: { criticalCount: fromCritRisks.length },
      afterValue: { criticalCount: toCritRisks.length, newRisks: newCrit },
    });
  } else if (mitigatedCrit.length > 0) {
    items.push({
      dimension: "CRITICAL_RISK",
      direction: "POSITIVE",
      severity: "MEDIUM",
      reasonCode: "CRITICAL_RISK_MITIGATED",
      sanitizedSummary: `Critical risk mitigated or resolved: "${mitigatedCrit[0]?.slice(0, 80)}...".`,
      beforeValue: { criticalCount: fromCritRisks.length },
      afterValue: { criticalCount: toCritRisks.length, resolvedRisks: mitigatedCrit },
    });
  }

  // 10. General Evidence Signals (Verified / Invalidated)
  const fromVerifiedSignals = (fromSnapshot.evidenceSignals || []).filter(
    (s) => s.verificationStatus === "VERIFIED",
  );
  const toVerifiedSignals = (toSnapshot.evidenceSignals || []).filter(
    (s) => s.verificationStatus === "VERIFIED",
  );
  const fromVMap = new Set(fromVerifiedSignals.map((s) => s.id));
  const newVerified = toVerifiedSignals.filter((s) => !fromVMap.has(s.id));

  // Only emit if not already emitted as WTP
  const generalNewVerified = newVerified.filter((s) => !newWtpSignals.some((w) => w.id === s.id));
  if (generalNewVerified.length > 0) {
    items.push({
      dimension: "EVIDENCE_SIGNAL",
      direction: "POSITIVE",
      severity: "LOW",
      reasonCode: "NEW_VERIFIED_SIGNAL",
      sanitizedSummary: `${generalNewVerified.length} verified evidence signal(s) attached.`,
      beforeValue: { verifiedCount: fromVerifiedSignals.length },
      afterValue: { verifiedCount: toVerifiedSignals.length },
      numericDelta: generalNewVerified.length,
      evidenceSignalIds: generalNewVerified.map((s) => s.id),
    });
  }

  const canonicalInputHash = computeCanonicalDiffHash(fromSnapshot, toSnapshot, diffVersion);
  const overallSeverity = getHighestSeverity(items.map((i) => i.severity));

  return {
    fromRevisionId: fromSnapshot.id,
    toRevisionId: toSnapshot.id,
    diffVersion,
    canonicalInputHash,
    overallSeverity,
    items,
  };
}
