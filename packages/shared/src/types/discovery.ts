export interface DiscoveryEvidenceObservation {
  id: string;
  sourceTitle: string;
  excerpt: string;
  canonicalUrl: string;
  sourceFamily: string;
  sourceName: string;
  publishedAt: string;
}

export interface DiscoveryFeedItemDTO {
  id: string;
  slug: string;
  title: string;
  summary: string;
  observedFacts: string[];
  evidenceObservations: DiscoveryEvidenceObservation[];
  businessHypothesis: {
    targetAudience: string;
    proposedSolution: string;
    painFriction: string;
    assumptions?: string[];
    validationExperiment?: string;
    purchaseIntentStatus?: "CONFIRMED" | "UNKNOWN";
    confidenceNote: string;
  };
  publicationDate: string;
  discoveredAt: string;
  market: string;
  canonicalUrl: string;
  sourceTitle: string;
  sourceFamily: string;
  verificationLabel: "Early idea / Not yet verified";
  signalCount: number;
  status: "DRAFT" | "HYPOTHESIS";
}

export interface ResearchLeadFeedItemDTO {
  id: string;
  slug?: string;
  title: string;
  summary: string;
  canonicalUrl: string;
  sourceTitle: string;
  sourceFamily: string;
  sourceName: string;
  publishedAt: string;
  discoveredAt: string;
  market: string;
  label: "Research Lead — uncorroborated customer pain signal requiring validation";
  observedFacts: string[];
  aiAssumptions: string[];
  plausibleBuyer: string;
  concreteValidationStep: string;
  problemSummary?: string;
  status: "RESEARCH_LEAD";
}

export interface MarketSignalFeedItemDTO {
  id: string;
  sourceKey: string;
  sourceName: string;
  sourceFamily: string;
  title: string;
  excerpt: string;
  canonicalUrl: string;
  publishedAt: string;
  discoveredAt: string;
  market: string;
  label: "Market signal — not a validated business opportunity";
}

export interface DailyThemeBriefDTO {
  theme: string;
  signalsCount: number;
  leadsCount: number;
  corroboratedCount: number;
  topPainHeadline: string;
  suggestedValidationAction: string;
  momentum: string;
}

export interface DailyPersonalizedBriefDTO {
  date: string;
  summary: string;
  themes: DailyThemeBriefDTO[];
}

export interface DiscoveryFeedResponseDTO {
  success: boolean;
  totalCount: number;
  asOf: string;
  hasItemsToday: boolean;
  marketSignals: MarketSignalFeedItemDTO[];
  researchLeads: ResearchLeadFeedItemDTO[];
  opportunityHypotheses: DiscoveryFeedItemDTO[];
  items: DiscoveryFeedItemDTO[]; // Preserved for backwards compatibility
  dailyBrief?: DailyPersonalizedBriefDTO;
}
