import { describe, it, expect } from "vitest";
import { cosineSimilarity, computeCentroid } from "../src/clustering/vector-math.js";

describe("Vector Math for pgvector & Clustering", () => {
  it("calculates exact similarity of 1.0 for identical vectors", () => {
    const v = [0.5, 0.5, 0.5, 0.5];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0);
  });

  it("calculates similarity of 0.0 for orthogonal vectors", () => {
    const v1 = [1, 0];
    const v2 = [0, 1];
    expect(cosineSimilarity(v1, v2)).toBe(0);
  });

  it("computes centroid accurately", () => {
    const v1 = [1, 2];
    const v2 = [3, 4];
    expect(computeCentroid([v1, v2])).toEqual([2, 3]);
  });
});
