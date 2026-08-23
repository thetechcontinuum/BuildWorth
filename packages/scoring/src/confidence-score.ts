import { ConfidenceInput } from "./types.js";

/**
 * Calculates the Evidence Confidence Score (0 - 100) strictly decoupled from the Opportunity Score.
 */
export function calculateEvidenceConfidence(input: ConfidenceInput): number {
  const { signals, now = new Date() } = input;
  if (!signals || signals.length === 0) return 0;

  // 1. Source Credibility (Weight 0.20)
  const avgCredibility =
    signals.reduce((acc, s) => acc + s.sourceCredibilityWeight, 0) / signals.length;
  const factorCredibility = Math.min(1.0, Math.max(0, avgCredibility));

  // 2. Independent Source Count (Weight 0.20) - max at 4 unique sources
  const uniqueSources = new Set(signals.map((s) => s.sourceType)).size;
  const factorSourceCount = Math.min(1.0, uniqueSources / 4);

  // 3. Source Diversity (Weight 0.15) - requires >1 distinct source family
  const factorDiversity = uniqueSources >= 3 ? 1.0 : uniqueSources === 2 ? 0.7 : 0.3;

  // 4. Evidence Recency (Weight 0.15) - exponential decay half-life
  let totalRecencyFactor = 0;
  for (const s of signals) {
    const ageDays = Math.max(
      0,
      (now.getTime() - new Date(s.publishedAt).getTime()) / (1000 * 60 * 60 * 24),
    );
    if (ageDays <= 90) totalRecencyFactor += 1.0;
    else if (ageDays <= 180) totalRecencyFactor += 0.75;
    else if (ageDays <= 365) totalRecencyFactor += 0.4;
    else totalRecencyFactor += 0.15;
  }
  const factorRecency = totalRecencyFactor / signals.length;

  // 5. Direct vs Inferred Intent (Weight 0.15)
  const directCount = signals.filter((s) => s.isDirectBuyerIntent).length;
  const factorDirectIntent = signals.length > 0 ? directCount / signals.length : 0;

  // 6. Sample Size (Weight 0.15) - N >= 10 users represented -> 1.0
  const totalUsers = signals.reduce((acc, s) => acc + (s.extractedUserCount || 1), 0);
  const factorSampleSize = Math.min(1.0, totalUsers / 10);

  const weightedTotal =
    factorCredibility * 0.2 +
    factorSourceCount * 0.2 +
    factorDiversity * 0.15 +
    factorRecency * 0.15 +
    factorDirectIntent * 0.15 +
    factorSampleSize * 0.15;

  return Math.min(100, Math.max(0, Math.round(weightedTotal * 100)));
}
