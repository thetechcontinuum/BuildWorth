import { cosineSimilarity } from "./vector-math.js";

export interface ClusterCandidate {
  id: string;
  problemSummary: string;
  vertical: string;
  embedding: number[];
}

export interface ProblemClusterResult {
  clusterId: string;
  title: string;
  summary: string;
  vertical: string;
  signalIds: string[];
  centroid: number[];
}

/**
 * Groups related signals into Problem Spaces based on cosine similarity threshold (default 0.75).
 */
export function clusterSignals(
  candidates: ClusterCandidate[],
  similarityThreshold = 0.75,
): ProblemClusterResult[] {
  const clusters: ProblemClusterResult[] = [];
  const assigned = new Set<string>();

  for (const item of candidates) {
    if (assigned.has(item.id)) continue;

    // Check existing clusters for closest match
    let bestCluster: ProblemClusterResult | null = null;
    let bestSim = 0;

    for (const c of clusters) {
      if (c.vertical !== item.vertical) continue;
      const sim = cosineSimilarity(item.embedding, c.centroid);
      if (sim >= similarityThreshold && sim > bestSim) {
        bestSim = sim;
        bestCluster = c;
      }
    }

    if (bestCluster) {
      bestCluster.signalIds.push(item.id);
      assigned.add(item.id);
    } else {
      // Create new cluster
      const newCluster: ProblemClusterResult = {
        clusterId: `cluster-${clusters.length + 1}`,
        title: item.problemSummary.slice(0, 60),
        summary: item.problemSummary,
        vertical: item.vertical,
        signalIds: [item.id],
        centroid: item.embedding,
      };
      clusters.push(newCluster);
      assigned.add(item.id);
    }
  }

  return clusters;
}
