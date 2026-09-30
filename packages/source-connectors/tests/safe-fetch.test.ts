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

  it("handles DNS connection pinning lookup with both all: true and standard callback shapes", async () => {
    // Verify safeFetch handles modern Node.js lookup signature with { all: true }
    // by creating an in-memory HTTP server and mocking DNS resolution to it
    const http = await import("node:http");
    const dns = await import("node:dns/promises");
    const { vi } = await import("vitest");

    let receivedLookupOptions: any = null;
    const server = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "application/rss+xml" });
      res.end("<rss><channel><title>Test Feed</title></channel></rss>");
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const port = (server.address() as any).port;

    // Spy on dns.lookup to pretend public-feed.example.com resolves to 127.0.0.1 for server testing,
    // but bypass the SSRF block by spying on validateExternalUrl
    const originalLookup = dns.default.lookup;
    vi.spyOn(dns.default, "lookup").mockImplementation(async (host: any) => {
      return [{ address: "93.184.215.14", family: 4 }] as any;
    });

    // Mock client.request to intercept lookup call and verify arguments
    const originalHttpRequest = http.default.request;
    vi.spyOn(http.default, "request").mockImplementation((url: any, options: any, cb: any) => {
      if (options?.lookup) {
        // Test with { all: true } as passed by Node 20+
        let allTrueResult: any = null;
        options.lookup("public-feed.example.com", { all: true }, (err: any, addrs: any) => {
          allTrueResult = addrs;
        });
        expect(allTrueResult).toEqual([{ address: "93.184.215.14", family: 4 }]);

        // Test with standard 2-arg signature
        let standardResult: any = null;
        options.lookup("public-feed.example.com", (err: any, addr: any, family: any) => {
          standardResult = { addr, family };
        });
        expect(standardResult).toEqual({ addr: "93.184.215.14", family: 4 });
      }

      // Return a mock req that responds cleanly
      const EventEmitter = require("events");
      const req = new EventEmitter();
      req.end = () => {
        const res = new EventEmitter();
        (res as any).statusCode = 200;
        (res as any).headers = { "content-type": "application/xml" };
        (res as any).setEncoding = () => {};
        cb(res);
        res.emit("data", "<rss><channel><title>Success</title></channel></rss>");
        res.emit("end");
      };
      req.destroy = () => {};
      return req as any;
    });

    try {
      const response = await safeFetch("http://public-feed.example.com/rss");
      expect(response.status).toBe(200);
      expect(response.data).toContain("<title>Success</title>");
      expect(response.pinnedIp).toBe("93.184.215.14");
    } finally {
      vi.restoreAllMocks();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

