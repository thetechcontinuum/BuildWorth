export const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+all\s+previous\s+instructions/i,
  /ignore\s+prior\s+instructions/i,
  /system\s+prompt/i,
  /jailbreak/i,
  /you\s+are\s+now\s+dan/i,
];

/**
 * Checks if a piece of text contains suspicious prompt-injection or jailbreak patterns
 * without mutating or altering the original plain text content.
 */
export function detectPromptInjection(input: string): boolean {
  if (!input || typeof input !== "string") return false;
  return PROMPT_INJECTION_PATTERNS.some((p) => p.test(input));
}

/**
 * Faithful plain-text extraction: Strips HTML tags, script/style blocks,
 * event handlers, and control characters, while preserving exact source wording.
 */
export function sanitizeToPlainText(input: string, maxLen = 280): string {
  if (!input || typeof input !== "string") return "";

  // 1. Remove script/style contents completely
  let cleaned = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ");
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ");

  // 2. Remove HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, " ");

  // 3. Decode common HTML entities faithfully
  cleaned = cleaned
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

  // 4. Remove control characters (except standard whitespace)
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // 5. Normalize consecutive whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  // 6. Enforce length boundary faithfully with ellipsis
  if (cleaned.length > maxLen) {
    const targetSlice = Math.max(0, maxLen - 3);
    cleaned = cleaned.slice(0, targetSlice).trimEnd() + "...";
  }

  return cleaned;
}
