import {
  EvidenceSignalItem,
  ClaimEvidenceLinkItem,
  ClaimType,
  ConfidenceExplanation,
} from "@buildworth/shared";
export interface ScoringDimensionInput {
  key: string;
  name: string;
  maxScore: number;
  rawScore: number;
  explanation: string;
  evidenceIds: string[];
  assumptions: string[];
}
export interface ConfidenceInput {
  evidenceLinks: ClaimEvidenceLinkItem[];
  now?: Date;
}
export { EvidenceSignalItem, ClaimEvidenceLinkItem, ClaimType, ConfidenceExplanation };
//# sourceMappingURL=types.d.ts.map
