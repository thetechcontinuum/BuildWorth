import { describe, it, expect } from "vitest";
import { computeContentHash, canonicalizeUrl } from "../src/dedup.js";

describe("Deduplication & URL Normalization", () => {
  it("computes identical hash for identical content regardless of capitalization/spacing", () => {
    const textA = "Our AWS Snowflake bill exploded last month!";
    const textB = "our aws snowflake bill exploded last month!";
    expect(computeContentHash(textA, "hn")).toBe(computeContentHash(textB, "hn"));
  });

  it("strips marketing UTM and tracking query parameters", () => {
    const url =
      "https://reddit.com/r/devops/comments/12345?utm_source=twitter&utm_medium=social&ref=feed#section";
    const cleaned = canonicalizeUrl(url);
    expect(cleaned).toBe("https://reddit.com/r/devops/comments/12345");
  });
});
