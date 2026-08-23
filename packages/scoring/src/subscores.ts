import { ScoreDimensionResult } from "@buildworth/shared";

/**
 * Computes normalized 0 - 100 subscores from evaluated dimension results.
 */
export function calculateNormalizedSubscores(dimensions: ScoreDimensionResult[]) {
  const getScore = (key: string) => dimensions.find((d) => d.dimensionKey === key)?.score || 0;

  const pain = getScore("pain_evidence"); // max 15
  const demand = getScore("buyer_demand_wtp"); // max 15
  const feasibility = getScore("technical_feasibility"); // max 15
  const economics = getScore("economics"); // max 15
  const market = getScore("market_attractiveness"); // max 10
  const accessibility = getScore("buyer_accessibility"); // max 10
  const competition = getScore("competition_differentiation"); // max 10
  const speed = getScore("speed_to_validation"); // max 5

  return {
    demandScore: Math.round(((pain + demand) / 30) * 100),
    feasibilityScore: Math.round((feasibility / 15) * 100),
    economicsScore: Math.round((economics / 15) * 100),
    competitionScore: Math.round((competition / 10) * 100),
    goMarketScore: Math.round(((market + accessibility + speed) / 25) * 100),
  };
}
