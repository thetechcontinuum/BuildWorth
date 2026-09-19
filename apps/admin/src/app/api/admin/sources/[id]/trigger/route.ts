import { NextRequest, NextResponse } from "next/server";
import { prisma, recordAuditLog } from "@buildworth/database";
import { executeManualStagingIngestion } from "@buildworth/opportunity-engine";
import { assertAdminMutation, NO_CACHE_HEADERS } from "@/lib/admin-auth";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await assertAdminMutation(request, "TRIGGER_SOURCE_INGESTION", "SOURCE", params.id);
  if (!auth.authorized) {
    return auth.response;
  }

  // Staging only guard
  if (process.env.BUILDWORTH_ENV === "production" || process.env.VERCEL_ENV === "production") {
    return NextResponse.json(
      { error: "Single-source manual ingestion is forbidden in Production" },
      { status: 403, headers: NO_CACHE_HEADERS },
    );
  }

  const source = await prisma.source.findUnique({ where: { id: params.id } });
  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404, headers: NO_CACHE_HEADERS });
  }

  if (!source.isEnabled || source.policyStatus === "BLOCKED") {
    return NextResponse.json(
      { error: `Cannot trigger ingestion for paused or blocked source '${source.name}'` },
      { status: 422, headers: NO_CACHE_HEADERS },
    );
  }

  const idempotencyKey = `admin_src_${source.key}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  try {
    const result = await executeManualStagingIngestion(prisma, {
      idempotencyKey,
      targetSourceKeys: [source.key],
      maxSources: 1,
      maxFetchItems: 15,
      maxRawSignals: 10,
      maxCandidates: 2,
      executionTimeoutMs: 30000,
    });

    await recordAuditLog({
      userId: auth.admin.id,
      action: "SOURCE_INGESTION_TRIGGERED",
      entityType: "SOURCE",
      entityId: source.id,
      reason: `Admin triggered targeted ingestion run for source ${source.name}`,
      details: {
        runId: result.runId,
        idempotencyKey,
        status: result.status,
        fetched: result.counters.fetched,
      },
      ipAddress: request.ip || request.headers.get("x-forwarded-for") || "127.0.0.1",
    });

    return NextResponse.json({ success: true, run: result }, { headers: NO_CACHE_HEADERS });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Ingestion trigger failed" },
      { status: 500, headers: NO_CACHE_HEADERS },
    );
  }
}
