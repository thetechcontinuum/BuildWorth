import { NextRequest, NextResponse } from "next/server";
import { prisma, recordAuditLog } from "@buildworth/database";
import { assertAdminMutation, requireAdminSession, NO_CACHE_HEADERS } from "@/lib/admin-auth";
import { validateExternalUrl } from "@buildworth/shared";
import dns from "node:dns/promises";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminSession(request);
  if (!auth.authorized) {
    return auth.response;
  }

  const source = await prisma.source.findUnique({
    where: { id: params.id },
    include: {
      runs: {
        orderBy: { startedAt: "desc" },
        take: 10,
      },
    },
  });

  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404, headers: NO_CACHE_HEADERS });
  }

  return NextResponse.json({ success: true, source }, { headers: NO_CACHE_HEADERS });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await assertAdminMutation(request, "UPDATE_SOURCE", "SOURCE", params.id);
  if (!auth.authorized) {
    return auth.response;
  }

  const source = await prisma.source.findUnique({ where: { id: params.id } });
  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404, headers: NO_CACHE_HEADERS });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const updateData: any = {};

    // 1. Pause / Resume
    if (typeof body.isEnabled === "boolean") {
      // Security rule: REVIEW_REQUIRED or BLOCKED sources cannot be resumed without explicit policy approval
      if (body.isEnabled && (source.policyStatus === "REVIEW_REQUIRED" || source.policyStatus === "BLOCKED")) {
        return NextResponse.json(
          { error: `Cannot activate source while policyStatus is ${source.policyStatus}. Policy review required.` },
          { status: 422, headers: NO_CACHE_HEADERS },
        );
      }
      updateData.isEnabled = body.isEnabled;
    }

    // 2. Policy Status
    if (body.policyStatus && ["ALLOWED", "ALLOWED_WITH_RESTRICTIONS", "REVIEW_REQUIRED", "BLOCKED"].includes(body.policyStatus)) {
      updateData.policyStatus = body.policyStatus;
      updateData.policyReviewedAt = new Date();
      updateData.policyReviewedBy = auth.admin.email;
      if (body.policyNotes) updateData.policyNotes = body.policyNotes;

      // If set to BLOCKED, automatically disable
      if (body.policyStatus === "BLOCKED") {
        updateData.isEnabled = false;
      }
    }

    // 3. Name, description, rate limits
    if (typeof body.name === "string" && body.name.trim()) {
      updateData.name = body.name.trim();
    }
    if (typeof body.description === "string") {
      updateData.description = body.description.trim();
    }
    if (typeof body.rateLimitPerMinute === "number") {
      updateData.rateLimitPerMinute = Math.min(120, Math.max(10, body.rateLimitPerMinute));
    }
    if (typeof body.permittedExcerptLength === "number") {
      updateData.permittedExcerptLength = Math.min(500, Math.max(100, body.permittedExcerptLength));
    }

    // 4. Feed URL update (SSRF protected)
    if (body.baseUrl && body.baseUrl !== source.baseUrl) {
      const urlValidation = await validateExternalUrl(body.baseUrl, true, async (host) => {
        const addresses = await dns.lookup(host, { all: true });
        return addresses.map((a) => a.address);
      });
      if (!urlValidation.isValid) {
        return NextResponse.json(
          { error: `URL Safety Rejection: ${urlValidation.reason}` },
          { status: 400, headers: NO_CACHE_HEADERS },
        );
      }
      updateData.baseUrl = urlValidation.sanitizedUrl || body.baseUrl;
    }

    // 5. Archival
    if (body.archive === true) {
      updateData.isEnabled = false;
      updateData.policyStatus = "BLOCKED";
      updateData.policyNotes = "Archived by administrator. Historical citations preserved.";
    }

    const updated = await prisma.source.update({
      where: { id: source.id },
      data: updateData,
    });

    await recordAuditLog({
      userId: auth.admin.id,
      action: body.archive ? "SOURCE_ARCHIVED" : "SOURCE_UPDATED",
      entityType: "SOURCE",
      entityId: source.id,
      previousState: JSON.stringify({ isEnabled: source.isEnabled, policyStatus: source.policyStatus }),
      newState: JSON.stringify({ isEnabled: updated.isEnabled, policyStatus: updated.policyStatus }),
      reason: body.reason || `Admin updated source properties`,
      details: { changes: updateData },
      ipAddress: request.ip || request.headers.get("x-forwarded-for") || "127.0.0.1",
    });

    return NextResponse.json({ success: true, source: updated }, { headers: NO_CACHE_HEADERS });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Update failed" }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
