export interface ScoringDimensionInput {
  key: string;
  name: string;
  maxScore: number;
  rawScore: number;
  explanation: string;
  evidenceIds: string[];
  assumptions: string[];
}

export interface EvidenceSignalItem {
  id: string;
  sourceType: string;
  sourceCredibilityWeight: number; // 0 - 1
  isDirectBuyerIntent: boolean;
  publishedAt: Date;
  extractedUserCount: number;
}

export interface ConfidenceInput {
  signals: EvidenceSignalItem[];
  now?: Date;
}
