export interface UrlValidationResult {
  isValid: boolean;
  sanitizedUrl?: string;
  reason?: string;
  resolvedIp?: string;
}

/**
 * Checks if a string is a valid IPv4 address.
 */
function isIPv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return false;
    const n = Number(p);
    if (n < 0 || n > 255) return false;
  }
  return true;
}

/**
 * Checks if a string is a valid IPv6 address.
 */
function isIPv6(ip: string): boolean {
  return /^[0-9a-fA-F:.]+$/.test(ip) && ip.includes(":");
}

/**
 * Checks if an IP string is within blocked/private/loopback/link-local/metadata ranges.
 */
export function isIpBlocked(ip: string): boolean {
  if (!ip || typeof ip !== "string") return true;

  // IPv4 Checks
  if (isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    const [p0, p1, p2, p3] = parts;

    // 0.0.0.0/8 (Current network)
    if (p0 === 0) return true;

    // 127.0.0.0/8 (Loopback)
    if (p0 === 127) return true;

    // 10.0.0.0/8 (Private)
    if (p0 === 10) return true;

    // 172.16.0.0/12 (Private: 172.16.0.0 - 172.31.255.255)
    if (p0 === 172 && p1 !== undefined && p1 >= 16 && p1 <= 31) return true;

    // 192.168.0.0/16 (Private)
    if (p0 === 192 && p1 === 168) return true;

    // 169.254.0.0/16 (Link-Local & Cloud Metadata: 169.254.169.254)
    if (p0 === 169 && p1 === 254) return true;

    // 224.0.0.0/4 (Multicast)
    if (p0 !== undefined && p0 >= 224 && p0 <= 239) return true;

    // 240.0.0.0/4 (Reserved)
    if (p0 !== undefined && p0 >= 240) return true;

    // 255.255.255.255 (Broadcast)
    if (p0 === 255 && p1 === 255 && p2 === 255 && p3 === 255) return true;

    return false;
  }

  // IPv6 Checks
  if (isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    // ::1 (Loopback)
    if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;
    // :: (Unspecified)
    if (normalized === "::" || normalized === "0:0:0:0:0:0:0:0") return true;
    // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 or ::ffff:10.0.0.1)
    if (normalized.startsWith("::ffff:")) {
      const v4Part = normalized.replace("::ffff:", "");
      if (isIPv4(v4Part)) return isIpBlocked(v4Part);
    }
    // fe80::/10 (Link-Local)
    if (
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb")
    )
      return true;
    // fc00::/7 (Unique Local Address - ULA)
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
    // ff00::/8 (Multicast)
    if (normalized.startsWith("ff")) return true;
  }

  return false;
}

/**
 * Validates a URL for UI rendering or outbound connection safety.
 */
export async function validateExternalUrl(
  urlString: string,
  checkDns = false,
  dnsLookupFn?: (hostname: string) => Promise<string[]>,
): Promise<UrlValidationResult> {
  if (!urlString || typeof urlString !== "string") {
    return { isValid: false, reason: "Empty URL" };
  }

  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return { isValid: false, reason: "Malformed URL" };
  }

  // 1. Allow only http and https
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { isValid: false, reason: `Unsupported protocol: ${parsed.protocol}` };
  }

  // 2. Reject embedded credentials (user:pass@host)
  if (parsed.username || parsed.password) {
    return { isValid: false, reason: "URL contains embedded credentials" };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 3. Reject localhost and local domain names
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".test")
  ) {
    return { isValid: false, reason: "Local hostnames are prohibited" };
  }

  // 4. Check if hostname is an IP literal
  if (isIPv4(hostname) || isIPv6(hostname)) {
    if (isIpBlocked(hostname)) {
      return { isValid: false, reason: `Direct IP is in a blocked/private range: ${hostname}` };
    }
  }

  // 5. Check allowed ports (default 80 and 443, or empty)
  if (parsed.port && parsed.port !== "80" && parsed.port !== "443") {
    return { isValid: false, reason: `Port ${parsed.port} is not permitted` };
  }

  // 6. Optional DNS Resolution Check via injected lookup function
  if (checkDns && dnsLookupFn && !isIPv4(hostname) && !isIPv6(hostname)) {
    try {
      const addresses = await dnsLookupFn(hostname);
      if (!addresses || addresses.length === 0) {
        return { isValid: false, reason: "DNS resolution failed: no addresses returned" };
      }

      for (const addr of addresses) {
        if (isIpBlocked(addr)) {
          return { isValid: false, reason: `DNS resolved to blocked IP address: ${addr}` };
        }
      }

      return {
        isValid: true,
        sanitizedUrl: parsed.toString(),
        resolvedIp: addresses[0],
      };
    } catch (err) {
      return {
        isValid: false,
        reason: `DNS lookup error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  return {
    isValid: true,
    sanitizedUrl: parsed.toString(),
  };
}
