import { RadarChangeSeverity } from "./types.js";

const SEVERITY_RANK: Record<RadarChangeSeverity, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export function getHighestSeverity(severities: RadarChangeSeverity[]): RadarChangeSeverity {
  if (!severities || severities.length === 0) return "LOW";

  let highest: RadarChangeSeverity = "LOW";
  let maxRank = SEVERITY_RANK.LOW;

  for (const s of severities) {
    const rank = SEVERITY_RANK[s] || 1;
    if (rank > maxRank) {
      maxRank = rank;
      highest = s;
    }
  }

  return highest;
}

export function isSeverityAtLeast(
  actual: RadarChangeSeverity,
  threshold: RadarChangeSeverity,
): boolean {
  return (SEVERITY_RANK[actual] || 1) >= (SEVERITY_RANK[threshold] || 1);
}
