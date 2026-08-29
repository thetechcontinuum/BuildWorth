import { FullVentureBlueprint } from "./blueprint.js";
import { FounderFitEvaluationResult } from "./founder-fit.js";
import { EvidenceSignalItem } from "./evidence.js";

export type OpportunityBlueprint = FullVentureBlueprint;
export type FounderFitEvaluation = FounderFitEvaluationResult;
export type NormalizedSignal = EvidenceSignalItem;


export type ContentCapabilityKey =
  | "opportunity.view.preview"
  | "opportunity.view.full"
  | "opportunity.export.pdf"
  | "opportunity.export.csv"
  | "opportunity.radar.history"
  | "founder_fit.view.full";

export interface LockedContentDescriptor {
  locked: true;
  capability: ContentCapabilityKey;
  reason: "PRO_REQUIRED" | "UNAUTHENTICATED" | "QUOTA_EXCEEDED" | "NOT_OWNER";
  previewTeaser?: string;
}

export interface PublicEvidenceTeaserDTO {
  id: string;
  sourceFamily: string;
  credibilityTier: string;
  publishedAt?: string;
  excerptTeaser: string;
}

export interface OpportunityPreviewDTO {
  id: string;
  slug: string;
  title: string;
  category: string;
  industry: string;
  summary: string;
  problemStatement: string;
  opportunityScore: number;
  confidenceScore: number;
  publicEvidenceCount: number;
  evidenceTeasers: PublicEvidenceTeaserDTO[];
  existingWorkflow: string;
  economicBuyer: string;
  endUser: string;
  painSeverity: string;
  painFrequency: string;
  decisionRecommendation: string;
  isLocked: boolean;
  lockedSections: {
    customerSegments: LockedContentDescriptor;
    mvpScope: LockedContentDescriptor;
    financialEconomics: LockedContentDescriptor;
    risksAndAssumptions: LockedContentDescriptor;
    validationRoadmap: LockedContentDescriptor;
    competitorWedge: LockedContentDescriptor;
    first20Plan: LockedContentDescriptor;
    fullEvidenceLineage: LockedContentDescriptor;
    exports: LockedContentDescriptor;
  };
}

export interface OpportunityFullDTO extends OpportunityPreviewDTO {
  isLocked: false;
  blueprint: OpportunityBlueprint;
  fullEvidenceSignals?: NormalizedSignal[];
  rawEvidenceExcerpts?: Array<{
    id: string;
    sourceName: string;
    sourceUrl: string;
    content: string;
    capturedAt: string;
  }>;
}

export interface FounderFitPreviewDTO {
  hasProfile: boolean;
  founderFitScore: number;
  fitConfidence: number;
  recommendationCategory: string;
  personalizedRank?: number;
  baseRank?: number;
  isLocked: boolean;
  lockedBreakdown: LockedContentDescriptor;
}

export interface FounderFitFullDTO extends FounderFitPreviewDTO {
  isLocked: false;
  evaluation: FounderFitEvaluation;
}

export interface ExportRequestPayload {
  format: "PDF" | "CSV";
  opportunitySlug: string;
  revisionId?: string;
  includeFounderFit?: boolean;
}

export interface ExportResponseDTO {
  exportId: string;
  format: "PDF" | "CSV";
  status: "PENDING" | "COMPLETED" | "FAILED";
  requestedAt: string;
  byteSize?: number;
  contentHash?: string;
  downloadUrl?: string;
}
