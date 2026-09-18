import { sanitizeToPlainText, detectPromptInjection } from "@buildworth/shared";
import { RawIngestSignal, SanitizedSignal } from "./types.js";
import crypto from "node:crypto";

export function sanitizeRawContent(input: string, maxLen = 280): string {
  return sanitizeToPlainText(input, maxLen);
}

export function deriveIndependenceKey(
  sourceKey: string,
  externalId: string,
  sourceUrl: string,
  authorFingerprint?: string,
  metadata?: Record<string, unknown>,
): { key: string; method: string } {
  if (sourceKey === "hackernews") {
    return {
      key: `hn:story:${externalId.replace(/[^0-9]/g, "") || "root"}`,
      method: "ROOT_THREAD",
    };
  }
  if (sourceKey === "reddit") {
    try {
      const parsed = new URL(sourceUrl);
      const parts = parsed.pathname.split("/").filter(Boolean);
      const sub = parts[1] || "all";
      const id = parts[3] || externalId;
      return { key: `reddit:post:${sub}:${id}`, method: "SUBMISSION_THREAD" };
    } catch {
      return { key: `reddit:post:${externalId}`, method: "EXTERNAL_ID" };
    }
  }
  if (sourceKey === "github") {
    try {
      const parsed = new URL(sourceUrl);
      const parts = parsed.pathname.split("/").filter(Boolean);
      const org = parts[0] || "org";
      const repo = parts[1] || "repo";
      return { key: `github:repo:${org}/${repo}`, method: "REPOSITORY_LEVEL" };
    } catch {
      return { key: `github:repo:${externalId}`, method: "EXTERNAL_ID" };
    }
  }
  if (sourceKey === "producthunt") {
    return { key: `ph:post:${externalId}`, method: "POST_ID" };
  }
  if (sourceKey === "krasia" || sourceKey === "e27") {
    const synPartner = (metadata?.syndicationPartner || metadata?.syndicatedPublisher || (metadata?.isSyndicated ? authorFingerprint : undefined)) as string | undefined;
    if (synPartner && synPartner.trim().length > 0) {
      const slugPartner = synPartner.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      return { key: `syndication:${slugPartner}`, method: "SYNDICATION_PARTNER" };
    }
    try {
      const parsed = new URL(sourceUrl);
      const slug = parsed.pathname.replace(/^\/+|\/+$/g, "").split("/")[0] || externalId;
      return { key: `${sourceKey}:article:${slug}`, method: "ARTICLE_SLUG" };
    } catch {
      return { key: `${sourceKey}:article:${externalId}`, method: "EXTERNAL_ID" };
    }
  }

  return { key: `source:${sourceKey}:${externalId}`, method: "SOURCE_EXTERNAL_ID" };
}

export function sanitizeSignal(raw: RawIngestSignal): SanitizedSignal {
  const plainText = sanitizeToPlainText(raw.rawContent, 280);
  const plainTitle = raw.title ? sanitizeToPlainText(raw.title, 140) : undefined;
  const hash = crypto
    .createHash("sha256")
    .update(plainText + (raw.sourceUrl || ""))
    .digest("hex");
  const { key: independenceKey, method: independenceMethod } = deriveIndependenceKey(
    raw.sourceKey,
    raw.externalId,
    raw.sourceUrl,
    raw.authorFingerprint,
    raw.metadata,
  );

  return {
    externalId: raw.externalId,
    sourceKey: raw.sourceKey,
    canonicalUrl: raw.sourceUrl,
    sanitizedTitle: plainTitle,
    sanitizedExcerpt: plainText,
    promptInjectionDetected: detectPromptInjection(raw.rawContent),
    contentHash: hash,
    publishedAt: raw.publishedAt || null,
    metadata: raw.metadata || {},
    authorFingerprint: raw.authorFingerprint,
    independenceKey,
    independenceMethod,
    evidenceOrigin: "COLLECTED",
  };
}
