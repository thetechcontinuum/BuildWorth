import { validateExternalUrl, isIpBlocked } from "@buildworth/shared";
import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";

export interface SafeFetchOptions {
  maxRedirects?: number;
  timeoutMs?: number;
  maxSizeBytes?: number;
  headers?: Record<string, string>;
}

export interface SafeFetchResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  data: string;
  finalUrl: string;
  pinnedIp: string;
}

/**
 * Server-side SSRF-defended HTTP fetch utility with Connection Pinning:
 * - Pre-validates URL format and protocol.
 * - Resolves DNS and blocks private/loopback/cloud metadata IP ranges.
 * - PINS the validated IP to the socket lookup to prevent DNS-rebinding attacks.
 * - Maintains correct TLS servername verification against the original hostname.
 * - Validates each redirect target against SSRF blocklist (up to maxRedirects).
 * - Enforces connect and response timeouts.
 * - Enforces response payload byte limits.
 */
export async function safeFetch(
  targetUrl: string,
  options: SafeFetchOptions = {},
): Promise<SafeFetchResponse> {
  const {
    maxRedirects = 3,
    timeoutMs = 5000,
    maxSizeBytes = 1024 * 1024, // 1MB cap
    headers = {},
  } = options;

  let currentUrl = targetUrl;
  let redirectCount = 0;

  while (redirectCount <= maxRedirects) {
    // 1. Validate URL syntax and structure
    const urlValidation = await validateExternalUrl(currentUrl, true, async (host) => {
      const addresses = await dns.lookup(host, { all: true });
      return addresses.map((a) => a.address);
    });

    if (!urlValidation.isValid) {
      throw new Error(`SSRF Blocked: Invalid target URL (${urlValidation.reason})`);
    }

    const parsed = new URL(currentUrl);

    // 2. Resolve DNS immediately and pick validated pinned IP
    const resolvedIps = await dns.lookup(parsed.hostname, { all: true });
    if (!resolvedIps || resolvedIps.length === 0) {
      throw new Error(`DNS resolution returned 0 records for host ${parsed.hostname}`);
    }

    for (const record of resolvedIps) {
      if (isIpBlocked(record.address)) {
        throw new Error(
          `SSRF Blocked: Host ${parsed.hostname} resolved to blocked IP ${record.address}`,
        );
      }
    }

    const pinnedIp = (resolvedIps[0] && resolvedIps[0].address) || "127.0.0.1";
    const isHttps = parsed.protocol === "https:";
    const client = isHttps ? https : http;

    // 3. Perform request with PINNED DNS lookup override and preserved TLS servername
    const response = await new Promise<SafeFetchResponse>((resolve, reject) => {
      const req = client.request(
        parsed,
        {
          method: "GET",
          headers: {
            "User-Agent": "BuildWorth-Market-Intelligence/1.0",
            ...headers,
          },
          timeout: timeoutMs,
          // Connection pinning: custom lookup that always returns the pre-validated IP
          lookup: (_hostname, _options, callback) => {
            const family = pinnedIp.includes(":") ? 6 : 4;
            callback(null, pinnedIp, family);
          },
          // For HTTPS, preserve the original hostname in SNI and certificate verification
          servername: isHttps ? parsed.hostname : undefined,
        },
        (res) => {
          // Handle Redirects
          if (
            res.statusCode &&
            [301, 302, 303, 307, 308].includes(res.statusCode) &&
            res.headers.location
          ) {
            const redirectTarget = new URL(res.headers.location, currentUrl).toString();
            res.resume(); // discard body
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: redirectTarget,
              finalUrl: redirectTarget,
              pinnedIp,
            });
            return;
          }

          let totalBytes = 0;
          let body = "";

          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            totalBytes += Buffer.byteLength(chunk);
            if (totalBytes > maxSizeBytes) {
              req.destroy();
              reject(
                new Error(
                  `Response payload exceeded maximum allowed size of ${maxSizeBytes} bytes`,
                ),
              );
              return;
            }
            body += chunk;
          });

          res.on("end", () => {
            resolve({
              status: res.statusCode || 200,
              headers: res.headers,
              data: body,
              finalUrl: currentUrl,
              pinnedIp,
            });
          });
        },
      );

      req.on("timeout", () => {
        req.destroy();
        reject(new Error(`Request timed out after ${timeoutMs}ms`));
      });

      req.on("error", (err) => {
        reject(err);
      });

      req.end();
    });

    // If response is a redirect, continue loop and revalidate
    if ([301, 302, 303, 307, 308].includes(response.status) && response.finalUrl !== currentUrl) {
      redirectCount++;
      currentUrl = response.finalUrl;
      continue;
    }

    return response;
  }

  throw new Error(`Exceeded maximum allowed redirects (${maxRedirects})`);
}
