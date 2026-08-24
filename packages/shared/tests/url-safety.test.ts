import { describe, it, expect } from "vitest";
import { validateExternalUrl, isIpBlocked, sanitizeToPlainText } from "../src/index.js";

describe("URL Safety and Plain Text Sanitization", () => {
  describe("IP Blocking", () => {
    it("blocks IPv4 loopback, private, and cloud metadata IPs", () => {
      expect(isIpBlocked("127.0.0.1")).toBe(true);
      expect(isIpBlocked("10.0.1.5")).toBe(true);
      expect(isIpBlocked("172.20.0.1")).toBe(true);
      expect(isIpBlocked("192.168.1.1")).toBe(true);
      expect(isIpBlocked("169.254.169.254")).toBe(true);
      expect(isIpBlocked("8.8.8.8")).toBe(false);
    });

    it("blocks IPv6 loopback, private, and IPv4-mapped private IPs", () => {
      expect(isIpBlocked("::1")).toBe(true);
      expect(isIpBlocked("fe80::1")).toBe(true);
      expect(isIpBlocked("::ffff:127.0.0.1")).toBe(true);
      expect(isIpBlocked("::ffff:169.254.169.254")).toBe(true);
      expect(isIpBlocked("2001:4860:4860::8888")).toBe(false);
    });
  });

  describe("URL Protocol and SSRF Guard", () => {
    it("rejects non-http protocols and embedded credentials", async () => {
      const fileRes = await validateExternalUrl("file:///etc/passwd");
      expect(fileRes.isValid).toBe(false);

      const jsRes = await validateExternalUrl("javascript:alert(1)");
      expect(jsRes.isValid).toBe(false);

      const credRes = await validateExternalUrl("https://admin:secret@news.ycombinator.com");
      expect(credRes.isValid).toBe(false);
    });

    it("rejects local and private hostnames", async () => {
      const localRes = await validateExternalUrl("http://localhost:3000");
      expect(localRes.isValid).toBe(false);

      const internalRes = await validateExternalUrl("http://service.internal");
      expect(internalRes.isValid).toBe(false);
    });

    it("accepts valid public HTTPS URLs", async () => {
      const validRes = await validateExternalUrl("https://news.ycombinator.com/item?id=38491021");
      expect(validRes.isValid).toBe(true);
      expect(validRes.sanitizedUrl).toBe("https://news.ycombinator.com/item?id=38491021");
    });
  });

  describe("Plain Text Sanitization", () => {
    it("strips HTML tags, script blocks, and normalizes whitespace", () => {
      const dirtyHtml =
        "<p>Our team spent <strong>40 hours</strong> on <script>alert(123)</script> compliance screenshots.</p>";
      const sanitized = sanitizeToPlainText(dirtyHtml, 280);
      expect(sanitized).toBe("Our team spent 40 hours on compliance screenshots.");
      expect(sanitized).not.toContain("<script>");
      expect(sanitized).not.toContain("<p>");
    });

    it("enforces max length truncation", () => {
      const longText = "a".repeat(300);
      const sanitized = sanitizeToPlainText(longText, 100);
      expect(sanitized.length).toBeLessThanOrEqual(103);
      expect(sanitized.endsWith("...")).toBe(true);
    });
  });
});
