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

export interface DiscoveryFeedResponseDTO {
  success: boolean;
  totalCount: number;
  asOf: string;
  hasItemsToday: boolean;
  marketSignals: MarketSignalFeedItemDTO[];
  opportunityHypotheses: DiscoveryFeedItemDTO[];
  items: DiscoveryFeedItemDTO[]; // Preserved for backwards compatibility
}
