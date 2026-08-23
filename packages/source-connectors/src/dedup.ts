import crypto from "crypto";

/**
 * Computes deterministic SHA-256 hash of normalized text for exact/near deduplication.
 */
export function computeContentHash(content: string, sourceKey = ""): string {
  const normalized = content.toLowerCase().replace(/[^a-z0-9]/g, "");
  return crypto.createHash("sha256").update(`${sourceKey}:${normalized}`).digest("hex");
}

/**
 * Cleans tracking params (utm_*, ref, fbclid) to get canonical deduplicated URLs.
 */
export function canonicalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const trackingParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "ref",
      "fbclid",
      "gclid",
    ];
    for (const p of trackingParams) {
      url.searchParams.delete(p);
    }
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return rawUrl.trim();
  }
}
