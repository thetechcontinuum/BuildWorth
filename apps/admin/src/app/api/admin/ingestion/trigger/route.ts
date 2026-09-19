import { NextRequest, NextResponse } from "next/server";
import { prisma, recordAuditLog } from "@buildworth/database";
import { executeManualStagingIngestion } from "@buildworth/opportunity-engine";
import { assertAdminMutation, NO_CACHE_HEADERS } from "@/lib/admin-auth";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await assertAdminMutation(request, "TRIGGER_MANUAL_INGESTION", "INGESTION_RUN");
  if (!auth.authorized) {
    return auth.response;
  }

  // Staging only guard
  if (process.env.BUILDWORTH_ENV === "production" || process.env.VERCEL_ENV === "production") {
    return NextResponse.json(
      { error: "Manual ingestion runs are forbidden in Production environment" },
      { status: 403, headers: NO_CACHE_HEADERS },
    );
  }

  // Double-submit guard: check if another run is currently PROCESSING
  const activeRun = await prisma.ingestionRun.findFirst({
    where: {
      status: "PROCESSING",
      lockedUntil: { gt: new Date() },
    },
  });

  if (activeRun) {
    return NextResponse.json(
      { error: `An ingestion run is already in progress (Run ID: ${activeRun.id}). Please wait for it to complete.` },
      { status: 409, headers: NO_CACHE_HEADERS },
    );
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // optional body
  }

  const targetSourceKeys = Array.isArray(body.targetSourceKeys) && body.targetSourceKeys.length > 0
    ? body.targetSourceKeys
    : undefined;

  const maxSources = typeof body.maxSources === "number" && body.maxSources > 0 ? Math.min(body.maxSources, 5) : 3;
  const maxFetchItems = typeof body.maxFetchItems === "number" && body.maxFetchItems > 0 ? Math.min(body.maxFetchItems, 20) : 10;
  const maxRawSignals = typeof body.maxRawSignals === "number" && body.maxRawSignals > 0 ? Math.min(body.maxRawSignals, 15) : 10;
  const maxCandidates = typeof body.maxCandidates === "number" && body.maxCandidates > 0 ? Math.min(body.maxCandidates, 5) : 2;

  const idempotencyKey = `admin_manual_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  try {
    const result = await executeManualStagingIngestion(prisma, {
      idempotencyKey,
      targetSourceKeys,
      maxSources,
      maxFetchItems,
      maxRawSignals,
      maxCandidates,
      executionTimeoutMs: 60000,
    });

    await recordAuditLog({
      userId: auth.admin.id,
      action: "MANUAL_INGESTION_TRIGGERED",
      entityType: "INGESTION_RUN",
      entityId: result.runId,
      reason: "Admin manually triggered bounded ingestion pass from Admin UI",
      details: {
        idempotencyKey,
        targetSourceKeys: targetSourceKeys || "all_active",
        status: result.status,
        counters: result.counters,
      },
      ipAddress: request.ip || request.headers.get("x-forwarded-for") || "127.0.0.1",
    });

    return NextResponse.json({ success: true, run: result }, { headers: NO_CACHE_HEADERS });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Manual ingestion execution failed" },
      { status: 500, headers: NO_CACHE_HEADERS },
    );
  }
}
