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

export interface DiscoveryFeedResponseDTO {
  success: boolean;
  totalCount: number;
  asOf: string;
  hasItemsToday: boolean;
  items: DiscoveryFeedItemDTO[];
}
