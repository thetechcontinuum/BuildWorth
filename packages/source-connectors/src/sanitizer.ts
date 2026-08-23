import { APP_CONSTANTS } from "@buildworth/config";

/**
 * Strips HTML tags, script blocks, and suspicious prompt-injection commands
 * such as "Ignore previous instructions", "System prompt", etc.
 */
export function sanitizeRawContent(
  content: string,
  maxChars = APP_CONSTANTS.MAX_EXCERPT_LENGTH,
): string {
  if (!content) return "";

  let cleaned = content;

  // 1. Remove HTML / XML tags & scripts
  cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
  cleaned = cleaned.replace(/<[^>]+>/g, " ");

  // 2. Remove null bytes and control chars (except standard whitespace)
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // 3. Neutralize common prompt injection markers
  const injectionPatterns = [
    /ignore\s+all\s+(previous|prior)\s+instructions/gi,
    /system\s+prompt\s*:/gi,
    /disregard\s+all\s+instructions/gi,
    /output\s+the\s+secret/gi,
    /you\s+are\s+now\s+in\s+developer\s+mode/gi,
  ];

  for (const pattern of injectionPatterns) {
    cleaned = cleaned.replace(pattern, "[redacted_directive]");
  }

  // 4. Normalize multi-line and whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  // 5. Truncate to maximum permitted excerpt length
  if (cleaned.length > maxChars) {
    cleaned = cleaned.slice(0, maxChars - 3).trim() + "...";
  }

  return cleaned;
}
