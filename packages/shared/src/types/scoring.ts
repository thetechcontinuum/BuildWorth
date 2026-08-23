export interface ScoreDimensionResult {
  dimensionKey: string;
  name: string;
  score: number;
  maxScore: number;
  explanation: string;
  evidenceIds: string[];
  assumptions: string[];
}

export interface ScorecardResult {
  opportunityScore: number; // 0 - 100
  evidenceConfidenceScore: number; // 0 - 100
  demandScore: number; // 0 - 100
  feasibilityScore: number; // 0 - 100
  economicsScore: number; // 0 - 100
  competitionScore: number; // 0 - 100
  goMarketScore: number; // 0 - 100
  rubricVersion: string;
  calculatedAt: string;
  isHypothesisOnly: boolean;
  dimensions: ScoreDimensionResult[];
}
