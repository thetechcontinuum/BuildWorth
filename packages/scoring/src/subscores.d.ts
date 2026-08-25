import { ScoreDimensionResult } from "@buildworth/shared";
/**
 * Computes normalized 0 - 100 subscores from evaluated dimension results.
 */
export declare function calculateNormalizedSubscores(dimensions: ScoreDimensionResult[]): {
    demandScore: number;
    feasibilityScore: number;
    economicsScore: number;
    competitionScore: number;
    goMarketScore: number;
};
//# sourceMappingURL=subscores.d.ts.map