import { describe, it, expect } from "vitest";
import { safeFetch } from "../src/safe-fetch.js";

describe("SSRF Defense & Connection Pinning Tests", () => {
  it("blocks direct requests to localhost and 127.0.0.1", async () => {
    await expect(safeFetch("http://127.0.0.1:8080/secret")).rejects.toThrow("SSRF Blocked");
    await expect(safeFetch("http://localhost:3000/api")).rejects.toThrow("SSRF Blocked");
  });

  it("blocks cloud metadata IP 169.254.169.254", async () => {
    await expect(safeFetch("http://169.254.169.254/latest/meta-data")).rejects.toThrow(
      "SSRF Blocked",
    );
  });

  it("blocks private network CIDRs (10.0.0.0/8, 192.168.0.0/16, 172.16.0.0/12)", async () => {
    await expect(safeFetch("http://10.0.1.5/admin")).rejects.toThrow("SSRF Blocked");
    await expect(safeFetch("http://192.168.1.1/router")).rejects.toThrow("SSRF Blocked");
    await expect(safeFetch("http://172.20.0.1/docker")).rejects.toThrow("SSRF Blocked");
  });

  it("rejects URLs with embedded credentials", async () => {
    await expect(safeFetch("https://user:password@example.com")).rejects.toThrow("SSRF Blocked");
  });

  it("rejects non-standard ports", async () => {
    await expect(safeFetch("https://example.com:22/ssh")).rejects.toThrow("SSRF Blocked");
  });
});
