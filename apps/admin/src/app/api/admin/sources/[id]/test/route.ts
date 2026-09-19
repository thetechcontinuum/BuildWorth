import { NextRequest, NextResponse } from "next/server";
import { prisma, recordAuditLog } from "@buildworth/database";
import { sourceRegistry, GenericRssAdapter } from "@buildworth/source-connectors";
import { assertAdminMutation, NO_CACHE_HEADERS } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await assertAdminMutation(request, "TEST_SOURCE", "SOURCE", params.id);
  if (!auth.authorized) {
    return auth.response;
  }

  const source = await prisma.source.findUnique({ where: { id: params.id } });
  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404, headers: NO_CACHE_HEADERS });
  }

  try {
    let adapter = sourceRegistry.getAdapter(source.key);
    if (!adapter && source.adapterType === "GENERIC_RSS" && source.baseUrl) {
      adapter = new GenericRssAdapter({
        sourceKey: source.key,
        name: source.name,
        feedUrl: source.baseUrl,
        rateLimitPerMinute: source.rateLimitPerMinute,
        termsNotes: source.termsNotes || undefined,
        attributionRequired: source.attributionRequired,
        permittedExcerptLength: source.permittedExcerptLength,
        sourceFamily: source.sourceFamily || "COMMUNITY",
      });
    }

    if (!adapter) {
      return NextResponse.json(
        { error: `No active connector available for adapter type '${source.adapterType}'` },
        { status: 422, headers: NO_CACHE_HEADERS },
      );
    }

    // Bounded fetch: max 5 genuine items preview
    const signals = await adapter.fetchSignals(5);

    await recordAuditLog({
      userId: auth.admin.id,
      action: "SOURCE_TESTED",
      entityType: "SOURCE",
      entityId: source.id,
      reason: `Admin ran preview test fetch on ${source.name}`,
      details: { itemsCount: signals.length, sourceKey: source.key },
      ipAddress: request.ip || request.headers.get("x-forwarded-for") || "127.0.0.1",
    });

    return NextResponse.json(
      {
        success: true,
        source: {
          id: source.id,
          name: source.name,
          key: source.key,
          adapterType: source.adapterType,
        },
        itemsCount: signals.length,
        items: signals.map((s: any) => ({
          externalId: s.externalId,
          title: s.title || "(Untitled)",
          url: s.sourceUrl,
          author: s.authorFingerprint || "Unknown",
          publishedAt: s.publishedAt,
          promptInjectionDetected: s.promptInjectionDetected || false,
          excerpt: s.rawContent,
        })),
      },
      { headers: NO_CACHE_HEADERS },
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to preview source items" },
      { status: 500, headers: NO_CACHE_HEADERS },
    );
  }
}
