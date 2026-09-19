import { NextRequest, NextResponse } from "next/server";
import { prisma, recordAuditLog } from "@buildworth/database";
import { assertAdminMutation, requireAdminSession, NO_CACHE_HEADERS } from "@/lib/admin-auth";
import { validateExternalUrl, isIpBlocked } from "@buildworth/shared";
import dns from "node:dns/promises";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.authorized) {
    return auth.response;
  }

  const sources = await prisma.source.findMany({
    include: {
      runs: {
        orderBy: { startedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ success: true, sources }, { headers: NO_CACHE_HEADERS });
}

export async function POST(request: NextRequest) {
  const auth = await assertAdminMutation(request, "CREATE_SOURCE", "SOURCE", "NEW");
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const body = await request.json().catch(() => ({}));
    const {
      name,
      feedUrl,
      sourceKey,
      description,
      sourceFamily = "COMMUNITY",
      rateLimitPerMinute = 60,
      permittedExcerptLength = 280,
      attributionRequired = true,
      termsNotes,
    } = body;

    if (!name || !feedUrl) {
      return NextResponse.json(
        { error: "Name and Feed URL are required." },
        { status: 400, headers: NO_CACHE_HEADERS },
      );
    }

    // SSRF URL Validation with DNS lookup and private IP blocking
    const urlValidation = await validateExternalUrl(feedUrl, true, async (host) => {
      const addresses = await dns.lookup(host, { all: true });
      return addresses.map((a) => a.address);
    });

    if (!urlValidation.isValid) {
      return NextResponse.json(
        { error: `URL Safety Rejection: ${urlValidation.reason}` },
        { status: 400, headers: NO_CACHE_HEADERS },
      );
    }

    const key =
      sourceKey?.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "") ||
      `rss_${name.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 24)}_${Date.now().toString().slice(-4)}`;

    const existing = await prisma.source.findUnique({ where: { key } });
    if (existing) {
      return NextResponse.json(
        { error: `A source with key '${key}' already exists.` },
        { status: 409, headers: NO_CACHE_HEADERS },
      );
    }

    const source = await prisma.source.create({
      data: {
        key,
        name: name.trim(),
        description: description?.trim() || `RSS feed from ${name}`,
        sourceFamily,
        baseUrl: urlValidation.sanitizedUrl || feedUrl,
        adapterType: "GENERIC_RSS",
        accessMethod: "RSS",
        policyStatus: "ALLOWED",
        credibilityTier: "TIER_2_CREDIBLE_PUBLIC",
        rateLimitPerMinute: Math.min(120, Math.max(10, rateLimitPerMinute)),
        permittedExcerptLength: Math.min(500, Math.max(100, permittedExcerptLength)),
        attributionRequired,
        termsNotes: termsNotes || "Generic RSS feed with attribution requirement.",
        isEnabled: true,
      },
    });

    await recordAuditLog({
      userId: auth.admin.id,
      action: "SOURCE_CREATED",
      entityType: "SOURCE",
      entityId: source.id,
      newState: "ACTIVE",
      reason: `Admin created generic RSS source ${source.name}`,
      details: {
        key: source.key,
        feedUrl: source.baseUrl,
        adapterType: source.adapterType,
      },
      ipAddress: request.ip || request.headers.get("x-forwarded-for") || "127.0.0.1",
    });

    return NextResponse.json({ success: true, source }, { status: 201, headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to create source" },
      { status: 500, headers: NO_CACHE_HEADERS },
    );
  }
}
