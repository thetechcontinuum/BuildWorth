import crypto from "crypto";
import {
  OpportunityBlueprint,
  FounderFitEvaluation,
  UserEntitlementContext,
} from "@buildworth/shared";
import { enforceAtomicUsage } from "@buildworth/entitlements";

/**
 * Security: Neutralize CSV formula injection attacks in spreadsheet programs
 * Prefixes any string value starting with '=', '+', '-', '@', '\t', '\r' with a single quote.
 */
export function sanitizeCsvField(val: any): string {
  if (val === null || val === undefined) return "";
  let str = String(val);

  // Check for dangerous leading character
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Handle RFC 4180 escaping if quotes, commas or newlines present
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Build CSV string from opportunity, blueprint, and optional owner founder fit
 */
export function generateOpportunityCsv(
  opportunity: any,
  blueprint: any,
  evaluation?: FounderFitEvaluation | null,
): string {
  const recommendation =
    blueprint?.decisionEvaluation?.recommendation ||
    blueprint?.recommendation ||
    opportunity.decisionRecommendation ||
    "UNASSESSED";
  const primaryAdvantage =
    blueprint?.primaryAdvantage ||
    opportunity.primaryAdvantage ||
    blueprint?.gtmNarrative?.initialWedge ||
    "";
  const riskiestAssumption =
    blueprint?.riskiestAssumption ||
    opportunity.riskiestAssumption ||
    (blueprint?.assumptions?.[0]?.statement ?? "");
  const cheapestExperiment =
    blueprint?.cheapestExperiment ||
    opportunity.cheapestExperiment ||
    (blueprint?.validationExperiments?.[0]?.hypothesis ?? "");

  const minWeeks =
    blueprint?.estimatedTimeToMvpWeeks?.min ?? opportunity.estimatedTimeToMvpMinWeeks ?? 4;
  const maxWeeks =
    blueprint?.estimatedTimeToMvpWeeks?.max ?? opportunity.estimatedTimeToMvpMaxWeeks ?? 8;
  const minCostCents =
    blueprint?.estimatedMvpCost?.minCents ??
    blueprint?.estimatedMvpCost?.minMinor ??
    opportunity.estimatedMvpCostMinCents ??
    100000;
  const maxCostCents =
    blueprint?.estimatedMvpCost?.maxCents ??
    blueprint?.estimatedMvpCost?.maxMinor ??
    opportunity.estimatedMvpCostMaxCents ??
    200000;
  const minOpCostCents =
    blueprint?.estimatedMonthlyOperatingCost?.minCents ??
    blueprint?.estimatedMonthlyOperatingCost?.minMinor ??
    opportunity.estimatedMonthlyOpCostMinCents ??
    10000;
  const maxOpCostCents =
    blueprint?.estimatedMonthlyOperatingCost?.maxCents ??
    blueprint?.estimatedMonthlyOperatingCost?.maxMinor ??
    opportunity.estimatedMonthlyOpCostMaxCents ??
    20000;

  const rows: Array<[string, string]> = [
    ["REPORT_TYPE", "BuildWorth Decision-Grade Venture Blueprint"],
    ["OPPORTUNITY_SLUG", opportunity.slug || ""],
    ["OPPORTUNITY_TITLE", opportunity.title || ""],
    ["CATEGORY", opportunity.category || opportunity.industry || "B2B SaaS"],
    ["OPPORTUNITY_SCORE", String(opportunity.opportunityScore || 0)],
    ["CONFIDENCE_SCORE", String(opportunity.confidenceScore || 0)],
    ["DECISION_RECOMMENDATION", recommendation],
    ["ONE_SENTENCE_SUMMARY", opportunity.summary || opportunity.oneSentenceSummary || ""],
    ["PROBLEM_STATEMENT", opportunity.problemStatement || ""],
    ["EXISTING_WORKFLOW", opportunity.existingWorkflow || ""],
    ["PRIMARY_ADVANTAGE", primaryAdvantage],
    ["RISKIEST_ASSUMPTION", riskiestAssumption],
    ["CHEAPEST_EXPERIMENT", cheapestExperiment],
    ["ESTIMATED_TIME_TO_MVP_WEEKS", `${minWeeks} - ${maxWeeks}`],
    ["ESTIMATED_MVP_COST_USD", `$${Math.round(minCostCents / 100)} - $${Math.round(maxCostCents / 100)}`],
    ["ESTIMATED_MONTHLY_OP_COST_USD", `$${Math.round(minOpCostCents / 100)} - $${Math.round(maxOpCostCents / 100)}`],
  ];

  // Customer Segments
  (blueprint?.customerSegments || []).forEach((seg: any, idx: number) => {
    const segName = seg.segmentName || seg.name || `Segment ${idx + 1}`;
    const isPrimary = seg.isPrimaryIcp ?? (idx === 0);
    const buyerRole = seg.economicBuyerRole || "Buyer";
    const budgetMin = seg.estimatedBudgetBand?.minCents ?? 500000;
    const budgetMax = seg.estimatedBudgetBand?.maxCents ?? 1500000;

    rows.push([`CUSTOMER_SEGMENT_${idx + 1}_NAME`, segName]);
    rows.push([`CUSTOMER_SEGMENT_${idx + 1}_ICP`, isPrimary ? "PRIMARY" : "SECONDARY"]);
    rows.push([`CUSTOMER_SEGMENT_${idx + 1}_BUYER_ROLE`, buyerRole]);
    rows.push([`CUSTOMER_SEGMENT_${idx + 1}_BUDGET_USD`, `$${Math.round(budgetMin / 100)} - $${Math.round(budgetMax / 100)}`]);
  });

  // MVP Scope
  (blueprint?.mvpFeatures || []).forEach((feat: any, idx: number) => {
    const featName = feat.featureName || feat.name || `Feature ${idx + 1}`;
    const priority = feat.category || feat.priority || "P0";
    const description = feat.description || "";
    rows.push([`MVP_FEATURE_${idx + 1}_NAME`, featName]);
    rows.push([`MVP_FEATURE_${idx + 1}_PRIORITY`, priority]);
    rows.push([`MVP_FEATURE_${idx + 1}_DESCRIPTION`, description]);
  });

  // Top Risks
  (blueprint?.risks || []).slice(0, 5).forEach((risk: any, idx: number) => {
    const category = risk.category || "GENERAL";
    const severity = risk.severity || "MEDIUM";
    const statement = risk.description || risk.riskStatement || "";
    const mitigation = risk.mitigationStrategy || "";
    rows.push([`RISK_${idx + 1}_CATEGORY`, category]);
    rows.push([`RISK_${idx + 1}_SEVERITY`, severity]);
    rows.push([`RISK_${idx + 1}_STATEMENT`, statement]);
    rows.push([`RISK_${idx + 1}_MITIGATION`, mitigation]);
  });

  // Competitors
  (blueprint?.competitors || []).slice(0, 5).forEach((comp: any, idx: number) => {
    const name = comp.name || `Competitor ${idx + 1}`;
    const category = comp.competitorType || comp.category || "INCUMBENT";
    const vulnerability = comp.differentiationHypothesis || comp.vulnerability || "";
    rows.push([`COMPETITOR_${idx + 1}_NAME`, name]);
    rows.push([`COMPETITOR_${idx + 1}_CATEGORY`, category]);
    rows.push([`COMPETITOR_${idx + 1}_VULNERABILITY`, vulnerability]);
  });

  // If Founder Fit is included (owner only)
  if (evaluation) {
    rows.push(["FOUNDER_FIT_SCORE", String(evaluation.founderFitScore)]);
    rows.push(["FOUNDER_FIT_CONFIDENCE", String(evaluation.fitConfidence)]);
    rows.push(["FOUNDER_FIT_RECOMMENDATION", evaluation.recommendationCategory]);
    (evaluation.dimensions || []).forEach((dim) => {
      rows.push([`FIT_DIMENSION_${dim.name.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`, `${dim.score}/${dim.maxScore} (${dim.explanation})`]);
    });
  }

  const csvLines = ["Field,Value"];
  for (const [k, v] of rows) {
    csvLines.push(`${sanitizeCsvField(k)},${sanitizeCsvField(v)}`);
  }

  return csvLines.join("\n");
}

/**
 * Escape text for safe embedding in PDF stream
 */
function escapePdfText(str: string): string {
  if (!str) return "";
  return str
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E\n]/g, " "); // ASCII printable only
}

/**
 * Generate a strict, valid PDF binary buffer (PDF-1.4 specification)
 * Contains zero scripts, active links, or external references.
 */
export function generateOpportunityPdf(
  opportunity: any,
  blueprint: any,
  evaluation?: FounderFitEvaluation | null,
): Buffer {
  const title = escapePdfText(opportunity.title || "Venture Opportunity");
  const slug = escapePdfText(opportunity.slug || "opp-slug");
  const score = opportunity.opportunityScore || 0;
  const conf = opportunity.confidenceScore || 0;
  const rec = escapePdfText(
    blueprint?.decisionEvaluation?.recommendation ||
      blueprint?.recommendation ||
      opportunity.decisionRecommendation ||
      "UNASSESSED",
  );
  const summary = escapePdfText(opportunity.summary || opportunity.oneSentenceSummary || "");
  const adv = escapePdfText(
    blueprint?.primaryAdvantage ||
      opportunity.primaryAdvantage ||
      blueprint?.gtmNarrative?.initialWedge ||
      "",
  );
  const exp = escapePdfText(
    blueprint?.cheapestExperiment ||
      opportunity.cheapestExperiment ||
      (blueprint?.validationExperiments?.[0]?.hypothesis ?? ""),
  );
  const generatedAt = new Date().toUTCString();

  const minWeeks =
    blueprint?.estimatedTimeToMvpWeeks?.min ?? opportunity.estimatedTimeToMvpMinWeeks ?? 4;
  const maxWeeks =
    blueprint?.estimatedTimeToMvpWeeks?.max ?? opportunity.estimatedTimeToMvpMaxWeeks ?? 8;
  const minCostCents =
    blueprint?.estimatedMvpCost?.minCents ??
    blueprint?.estimatedMvpCost?.minMinor ??
    opportunity.estimatedMvpCostMinCents ??
    100000;
  const maxCostCents =
    blueprint?.estimatedMvpCost?.maxCents ??
    blueprint?.estimatedMvpCost?.maxMinor ??
    opportunity.estimatedMvpCostMaxCents ??
    200000;

  const lines: string[] = [
    `BT /F1 18 Tf 50 750 Td (BUILDWORTH VENTURE DOSSIER) Tj ET`,
    `BT /F1 10 Tf 50 735 Td (Generated on: ${generatedAt} | Immutable Blueprint) Tj ET`,
    `BT /F1 14 Tf 50 705 Td (${title}) Tj ET`,
    `BT /F1 10 Tf 50 685 Td (Slug: ${slug} | Score: ${score}/100 | Confidence: ${conf}% | Decision: ${rec}) Tj ET`,
    `BT /F1 11 Tf 50 655 Td (Executive Summary:) Tj ET`,
    `BT /F1 9 Tf 50 640 Td (${summary.slice(0, 110)}) Tj ET`,
  ];

  if (summary.length > 110) {
    lines.push(`BT /F1 9 Tf 50 628 Td (${summary.slice(110, 220)}) Tj ET`);
  }

  lines.push(
    `BT /F1 11 Tf 50 600 Td (Key Strategic Metrics:) Tj ET`,
    `BT /F1 9 Tf 50 585 Td (Estimated Time to MVP: ${minWeeks} to ${maxWeeks} weeks) Tj ET`,
    `BT /F1 9 Tf 50 572 Td (Estimated MVP Build Cost: $${Math.round(minCostCents / 100)} - $${Math.round(maxCostCents / 100)}) Tj ET`,
    `BT /F1 9 Tf 50 559 Td (Primary Unfair Advantage: ${adv.slice(0, 90)}) Tj ET`,
    `BT /F1 9 Tf 50 546 Td (Recommended Next Experiment: ${exp.slice(0, 90)}) Tj ET`,
  );

  // Customer Segments preview
  lines.push(
    `BT /F1 11 Tf 50 520 Td (Customer Segments & Economic Buyers:) Tj ET`,
  );
  let y = 505;
  (blueprint?.customerSegments || []).slice(0, 3).forEach((seg: any, idx: number) => {
    const segName = escapePdfText(seg.segmentName || seg.name || `Segment ${idx + 1}`);
    const buyerRole = escapePdfText(seg.economicBuyerRole || "Buyer");
    const isPrimary = seg.isPrimaryIcp ?? (idx === 0);
    lines.push(
      `BT /F1 9 Tf 50 ${y} Td (${idx + 1}. ${segName} | Buyer: ${buyerRole} | ICP: ${isPrimary ? "PRIMARY" : "SECONDARY"}) Tj ET`,
    );
    y -= 14;
  });

  // Top Risks
  y -= 10;
  lines.push(`BT /F1 11 Tf 50 ${y} Td (Critical Risks & Mitigations:) Tj ET`);
  y -= 15;
  (blueprint?.risks || []).slice(0, 3).forEach((r: any, idx: number) => {
    const statement = r.description || r.riskStatement || "";
    lines.push(
      `BT /F1 9 Tf 50 ${y} Td (${idx + 1}. [${r.severity || "MEDIUM"}] ${escapePdfText(statement.slice(0, 80))}) Tj ET`,
    );
    y -= 14;
  });

  // Founder Fit Section (if included for owner)
  if (evaluation) {
    y -= 10;
    lines.push(
      `BT /F1 11 Tf 50 ${y} Td (Personalized Founder Fit Analysis [CONFIDENTIAL & OWNER-ISOLATED]:) Tj ET`,
    );
    y -= 15;
    lines.push(
      `BT /F1 9 Tf 50 ${y} Td (Founder Fit Score: ${evaluation.founderFitScore}/100 | Recommendation: ${evaluation.recommendationCategory}) Tj ET`,
    );
    y -= 14;
    (evaluation.dimensions || []).slice(0, 3).forEach((dim) => {
      lines.push(
        `BT /F1 9 Tf 50 ${y} Td (- ${escapePdfText(dim.name)}: ${dim.score}/${dim.maxScore} - ${escapePdfText(dim.explanation.slice(0, 70))}) Tj ET`,
      );
      y -= 14;
    });
  }

  const streamContent = lines.join("\n");
  const streamLength = Buffer.byteLength(streamContent);

  const objects: string[] = [
    // 1: Catalog
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
    // 2: Pages
    `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`,
    // 3: Page
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n`,
    // 4: Stream
    `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
    // 5: Font
    `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`,
  ];

  let header = "%PDF-1.4\n";
  let body = "";
  const xrefOffsets: number[] = [0];

  let currentOffset = Buffer.byteLength(header);

  for (const objStr of objects) {
    xrefOffsets.push(currentOffset);
    body += objStr;
    currentOffset += Buffer.byteLength(objStr);
  }

  const xrefStart = currentOffset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    xref += String(xrefOffsets[i]).padStart(10, "0") + " 00000 n \n";
  }

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(header + body + xref + trailer, "utf-8");
}





/**
 * Bounds & safety constants for export generation
 */
export const MAX_EXPORT_GENERATION_MS = 15000;
export const MAX_EXPORT_BYTE_SIZE = 10 * 1024 * 1024; // 10MB memory safety ceiling
export const EXPORT_RESERVATION_EXPIRY_MS = 30000; // 30s expiry for PENDING exports

/**
 * Validate client requestKey length and character set.
 * Generates an opaque random key (req_<32 random hex bytes>) when absent.
 * Throws an error for oversized or malformed keys.
 */
export function validateOrGenerateRequestKey(_userId?: string, requestKey?: string): string {
  if (!requestKey) {
    return `req_${crypto.randomBytes(32).toString("hex")}`;
  }
  if (typeof requestKey !== "string") {
    throw new Error("INVALID_REQUEST_KEY: requestKey must be a string.");
  }
  if (requestKey.length < 1 || requestKey.length > 128) {
    throw new Error("INVALID_REQUEST_KEY: requestKey length must be between 1 and 128 characters.");
  }
  if (!/^[a-zA-Z0-9_.:-]+$/.test(requestKey)) {
    throw new Error("INVALID_REQUEST_KEY: requestKey contains invalid characters. Only alphanumeric, '_', '.', ':', and '-' are permitted.");
  }
  return requestKey;
}

/**
 * Derive authoritative UTC quota period bucket key (e.g. "YYYY-MM")
 */
export function deriveAuthoritativeQuotaPeriodKey(date: Date = new Date()): string {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Safely reconcile abandoned/expired PENDING exports:
 * Under per-user advisory lock:
 * - verifies they are still PENDING;
 * - appends exactly one compensating RELEASE;
 * - sets releaseLedgerId;
 * - marks FAILED;
 * - sets failureCode = EXPORT_RESERVATION_EXPIRED;
 * - never releases COMPLETED exports;
 * - never creates two releases.
 */
export async function reconcileExpiredExports(
  prisma: any,
  filterUserId?: string,
): Promise<{ recoveredCount: number }> {
  const entitlementType = "VENTURE_BLUEPRINT_EXPORT";
  const now = new Date();

  // Find expired PENDING exports
  const expiredExports = await prisma.opportunityExport.findMany({
    where: {
      status: "PENDING",
      reservationExpiresAt: { lte: now },
      ...(filterUserId ? { userId: filterUserId } : {}),
    },
  });

  let recoveredCount = 0;

  for (const exp of expiredExports) {
    const quotaPeriodKey = exp.quotaPeriodKey || deriveAuthoritativeQuotaPeriodKey(exp.requestedAt);
    const lockKeyStr = `${exp.userId}:${entitlementType}:${quotaPeriodKey}`;
    let hash1 = 0;
    let hash2 = 0;
    for (let i = 0; i < lockKeyStr.length; i++) {
      const code = lockKeyStr.charCodeAt(i);
      if (i % 2 === 0) {
        hash1 = ((hash1 << 5) - hash1 + code) | 0;
      } else {
        hash2 = ((hash2 << 5) - hash2 + code) | 0;
      }
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock($1::int, $2::int);`, hash1, hash2);

      const current = await tx.opportunityExport.findUnique({
        where: { id: exp.id },
      });

      if (!current || current.status !== "PENDING") {
        return; // Already completed or failed
      }

      let releaseLedgerId = current.releaseLedgerId;
      if (current.reservationLedgerId && !releaseLedgerId) {
        const releaseIdempKey = `release_${current.userId}_${current.requestKey}`;
        const existingRel = await tx.usageLedger.findFirst({
          where: { idempotencyKey: releaseIdempKey },
        });
        if (!existingRel) {
          const rel = await tx.usageLedger.create({
            data: {
              userId: current.userId,
              entitlementType,
              unitsConsumed: -1,
              resourceId: current.opportunityId,
              actionContext: `EXPORT_RELEASE_${current.format}_EXPIRED`,
              idempotencyKey: releaseIdempKey,
              periodBucketKey: quotaPeriodKey,
            },
          });
          releaseLedgerId = rel.id;
        } else {
          releaseLedgerId = existingRel.id;
        }
      }

      await tx.opportunityExport.update({
        where: { id: exp.id },
        data: {
          status: "FAILED",
          failedAt: now,
          failureCode: "EXPORT_RESERVATION_EXPIRED",
          releaseLedgerId,
        },
      });

      recoveredCount++;
    });
  }

  return { recoveredCount };
}

/**
 * Execute server-authoritative export with transactional quota enforcement, advisory locking,
 * user-scoped idempotency, bounded in-memory generation, compensating failure releases,
 * and transactional pre-completion rechecks.
 */
export async function executeOpportunityExport(
  prisma: any,
  userId: string,
  opportunitySlug: string,
  format: "PDF" | "CSV",
  options: {
    context: UserEntitlementContext;
    requestKey?: string;
    revisionId?: string;
    includeFounderFit?: boolean;
    opportunityData?: any;
    blueprintData?: OpportunityBlueprint;
    evaluationData?: FounderFitEvaluation | null;
  },
): Promise<{
  success: boolean;
  exportRecord?: any;
  buffer?: Buffer;
  mimeType?: string;
  filename?: string;
  error?: string;
  statusCode: number;
}> {
  const entitlementType = "VENTURE_BLUEPRINT_EXPORT";

  // Validate or generate request key
  let requestKey: string;
  try {
    requestKey = validateOrGenerateRequestKey(userId, options.requestKey);
  } catch (err: any) {
    return {
      success: false,
      error: err.message,
      statusCode: 400,
    };
  }

  const quotaPeriodKey = deriveAuthoritativeQuotaPeriodKey(new Date());

  // Reconcile any expired reservations for this user before checking quota
  try {
    await reconcileExpiredExports(prisma, userId);
  } catch {}

  // 1. Fetch Opportunity and Authoritative Blueprint
  const opp =
    options.opportunityData ||
    (await prisma.opportunity.findUnique({
      where: { slug: opportunitySlug },
      include: {
        revisions: { orderBy: { revisionNumber: "desc" }, take: 1, include: { blueprint: true } },
      },
    }));

  if (!opp) {
    return {
      success: false,
      error: "Opportunity not found.",
      statusCode: 404,
    };
  }

  const latestRevision = opp.revisions?.[0] || {
    id: opp.currentRevisionId || opp.id,
    revisionNumber: 1,
    blueprint: options.blueprintData,
  };

  const revisionId = options.revisionId || latestRevision.id || opp.id;
  const blueprint = options.blueprintData || latestRevision.blueprint;

  // 2. USER-SCOPED IDEMPOTENCY CHECK
  // Resolve duplicate requests from opportunity_exports scoped strictly to (userId, requestKey)
  const existingExport = await prisma.opportunityExport.findUnique({
    where: {
      userId_requestKey: {
        userId,
        requestKey,
      },
    },
  });

  if (existingExport) {
    // Validate request-shaping options consistency
    const isSameOpportunity = existingExport.opportunityId === opp.id;
    const isSameRevision = existingExport.opportunityRevisionId === revisionId;
    const isSameFormat = existingExport.format === format;

    if (!isSameOpportunity || !isSameRevision || !isSameFormat) {
      return {
        success: false,
        error: "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST: Request payload does not match existing export.",
        statusCode: 409,
      };
    }

    if (existingExport.status === "COMPLETED") {
      // Re-generate matching buffer deterministically without re-consuming quota
      let buf: Buffer;
      if (format === "CSV") {
        buf = Buffer.from(generateOpportunityCsv(opp, blueprint, options.evaluationData), "utf-8");
      } else {
        buf = generateOpportunityPdf(opp, blueprint, options.evaluationData);
      }
      return {
        success: true,
        exportRecord: existingExport,
        buffer: buf,
        mimeType: format === "CSV" ? "text/csv; charset=utf-8" : "application/pdf",
        filename: `${opportunitySlug}-blueprint.${format.toLowerCase()}`,
        statusCode: 200,
      };
    } else if (existingExport.status === "FAILED" || existingExport.status === "REJECTED") {
      return {
        success: false,
        exportRecord: existingExport,
        error: existingExport.failureCode || "EXPORT_FAILED",
        statusCode: existingExport.status === "REJECTED" ? 403 : 500,
      };
    }
  }

  // 3. Stage A: Quota Reservation & Capability Enforcement via atomic advisory lock
  const reservationIdempKey = `reserve_${userId}_${requestKey}`;
  const enforcement = await enforceAtomicUsage(prisma, userId, entitlementType, {
    units: 1,
    actionContext: `EXPORT_RESERVE_${format}`,
    resourceId: opportunitySlug,
    idempotencyKey: reservationIdempKey,
    periodBucketKey: quotaPeriodKey,
  });

  if (!enforcement.allowed) {
    // Authenticated Rejection (consumes zero quota, logs REJECTED attempt)
    try {
      const rejectedRecord = await prisma.opportunityExport.create({
        data: {
          requestKey,
          userId,
          opportunityId: opp.id,
          opportunityRevisionId: revisionId,
          format,
          status: "REJECTED",
          quotaPeriodKey,
          rejectedAt: new Date(),
          failureCode: enforcement.error || "PRO_REQUIRED",
          entitlementSnapshot: options.context.entitlements || {},
        },
      });

      // Emit Server-Authoritative EXPORT_REJECTED Commercial Event
      try {
        const billingPkg = await import("@buildworth/billing");
        if (billingPkg && billingPkg.recordCommercialEvent) {
          await billingPkg.recordCommercialEvent(prisma, {
            eventType: "EXPORT_REJECTED",
            deduplicationKey: `exp_rej_${rejectedRecord.id}`,
            userId,
            opportunityId: opp.id,
            exportId: rejectedRecord.id,
            source: "EXPORT_SERVICE",
            metadata: {
              opportunitySlug,
              format,
              quotaPeriodKey,
              failureCode: enforcement.error || "PRO_REQUIRED",
              userTier: options.context.tier,
            },
          });
        }
      } catch (err: any) {
        console.error("Commercial Event Emission Error:", err?.message || err);
      }

      return {
        success: false,
        exportRecord: rejectedRecord,
        error: enforcement.upgradeRequired
          ? "PRO_REQUIRED: Upgrading to Pro is required to export blueprints."
          : "EXPORT_LIMIT_REACHED: Your monthly export quota has been reached.",
        statusCode: 403,
      };
    } catch {
      return {
        success: false,
        error: "EXPORT_REJECTED",
        statusCode: 403,
      };
    }
  }

  // Create or retrieve PENDING export record with reservationLedgerId and reservationExpiresAt
  const reservationExpiresAt = new Date(Date.now() + EXPORT_RESERVATION_EXPIRY_MS);
  let exportRecord: any;
  try {
    exportRecord = await prisma.opportunityExport.create({
      data: {
        requestKey,
        userId,
        opportunityId: opp.id,
        opportunityRevisionId: revisionId,
        format,
        status: "PENDING",
        quotaPeriodKey,
        reservationLedgerId: enforcement.ledgerId,
        reservationExpiresAt,
        entitlementSnapshot: options.context.entitlements || {},
      },
    });

    // Emit Server-Authoritative EXPORT_REQUESTED Commercial Event
    try {
      const billingPkg = await import("@buildworth/billing");
      if (billingPkg && billingPkg.recordCommercialEvent) {
        await billingPkg.recordCommercialEvent(prisma, {
          eventType: "EXPORT_REQUESTED",
          deduplicationKey: `exp_req_${exportRecord.id}`,
          userId,
          opportunityId: opp.id,
          exportId: exportRecord.id,
          source: "EXPORT_SERVICE",
          metadata: {
            opportunitySlug,
            format,
            quotaPeriodKey,
            userTier: options.context.tier,
          },
        });
      }
    } catch (err: any) {
      console.error("Commercial Event Emission Error:", err?.message || err);
    }
  } catch (err: any) {
    // If unique constraint violated on (userId, requestKey) (concurrent duplicate)
    const existing = await prisma.opportunityExport.findUnique({
      where: {
        userId_requestKey: {
          userId,
          requestKey,
        },
      },
    });
    if (existing) {
      exportRecord = existing;
    }
  }

  if (!blueprint) {
    // Release reserved quota
    let releaseLedgerId: string | null = null;
    if (enforcement.ledgerId) {
      try {
        const releaseIdempKey = `release_${userId}_${requestKey}`;
        const existingRel = await prisma.usageLedger.findFirst({
          where: { idempotencyKey: releaseIdempKey },
        });
        if (!existingRel) {
          const relLedger = await prisma.usageLedger.create({
            data: {
              userId,
              entitlementType,
              unitsConsumed: -1,
              resourceId: opportunitySlug,
              actionContext: `EXPORT_RELEASE_${format}_NO_BLUEPRINT`,
              idempotencyKey: releaseIdempKey,
              periodBucketKey: quotaPeriodKey,
            },
          });
          releaseLedgerId = relLedger.id;
        } else {
          releaseLedgerId = existingRel.id;
        }
      } catch {}
    }

    await prisma.opportunityExport.update({
      where: { id: exportRecord.id },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        failureCode: "BLUEPRINT_UNAVAILABLE",
        releaseLedgerId,
      },
    });
    return {
      success: false,
      error: "Opportunity blueprint data is unavailable.",
      statusCode: 422,
    };
  }

  // 4. Stage B: Bounded in-memory generation with timeout and size enforcement
  const startTime = Date.now();
  try {
    let fitEvaluation: FounderFitEvaluation | null = null;
    if (options.includeFounderFit && options.evaluationData) {
      fitEvaluation = options.evaluationData;
    }

    let outputBuffer: Buffer;
    let mimeType: string;
    let extension: string;

    if (format === "CSV") {
      const csvStr = generateOpportunityCsv(opp, blueprint, fitEvaluation);
      outputBuffer = Buffer.from(csvStr, "utf-8");
      mimeType = "text/csv; charset=utf-8";
      extension = "csv";
    } else {
      outputBuffer = generateOpportunityPdf(opp, blueprint, fitEvaluation);
      mimeType = "application/pdf";
      extension = "pdf";
    }

    const elapsedMs = Date.now() - startTime;
    if (elapsedMs > MAX_EXPORT_GENERATION_MS) {
      throw new Error(`EXPORT_TIMEOUT: Generation took ${elapsedMs}ms exceeding limit of ${MAX_EXPORT_GENERATION_MS}ms.`);
    }

    const byteSize = outputBuffer.length;
    if (byteSize > MAX_EXPORT_BYTE_SIZE) {
      throw new Error(`EXPORT_SIZE_EXCEEDED: Generated artifact ${byteSize} bytes exceeds ceiling of ${MAX_EXPORT_BYTE_SIZE} bytes.`);
    }

    const contentHash = crypto.createHash("sha256").update(outputBuffer).digest("hex");
    const safeDate = new Date().toISOString().slice(0, 10);
    const filename = `${opp.slug}-blueprint-${safeDate}.${extension}`;

    // 5. Stage C: Transactional Recheck & Final Consumption Transition
    // Before marking COMPLETED, transactionally recheck:
    // - export ownership (userId);
    // - PENDING status;
    // - current entitlement (re-resolve live server entitlement context);
    // - immutable revision;
    // - reservation ownership.
    const lockKeyStr = `${userId}:${entitlementType}:${quotaPeriodKey}`;
    let hash1 = 0;
    let hash2 = 0;
    for (let i = 0; i < lockKeyStr.length; i++) {
      const code = lockKeyStr.charCodeAt(i);
      if (i % 2 === 0) {
        hash1 = ((hash1 << 5) - hash1 + code) | 0;
      } else {
        hash2 = ((hash2 << 5) - hash2 + code) | 0;
      }
    }

    const completedRecord = await prisma.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock($1::int, $2::int);`, hash1, hash2);

      // Re-read current export state
      const currentExport = await tx.opportunityExport.findUnique({
        where: { id: exportRecord.id },
      });

      if (!currentExport || currentExport.userId !== userId) {
        throw new Error("EXPORT_OWNERSHIP_MISMATCH: User does not own this export record.");
      }

      if (currentExport.status !== "PENDING" && currentExport.status !== "COMPLETED") {
        throw new Error(`INVALID_EXPORT_STATE: Expected PENDING, got ${currentExport.status}`);
      }

      if (currentExport.opportunityRevisionId !== revisionId) {
        throw new Error("REVISION_MUTATION_DETECTED: Opportunity revision changed during export.");
      }

      // Re-verify reservation ledger ownership
      if (currentExport.reservationLedgerId) {
        const resLedger = await tx.usageLedger.findUnique({
          where: { id: currentExport.reservationLedgerId },
        });
        if (!resLedger || resLedger.userId !== userId || resLedger.entitlementType !== entitlementType) {
          throw new Error("RESERVATION_LEDGER_INVALID: Reservation ownership or capability mismatch.");
        }
      }

      // Re-check entitlement status from fresh database state
      const dbUser = await tx.user.findUnique({
        where: { id: userId },
        include: {
          billingSubscriptions: {
            where: { status: { in: ["ACTIVE", "TRIALING"] } },
            include: { planPrice: { include: { plan: true } } },
          },
          entitlementGrants: true,
        },
      });

      if (!dbUser) {
        throw new Error("USER_NOT_FOUND_AT_FINALIZATION");
      }

      // Import entitlement resolver dynamically if needed or check active subscription/tier
      const hasActivePaidSub = (dbUser.billingSubscriptions || []).some(
        (s: any) => s.status === "ACTIVE" && new Date(s.currentPeriodEnd) >= new Date(),
      );
      const hasDirectGrant = (dbUser.entitlementGrants || []).some(
        (g: any) => g.entitlementType === entitlementType && (g.isUnlimited || (g.remainingUnits ?? 0) > 0),
      );

      if (dbUser.tier === "FREE" && !hasActivePaidSub && !hasDirectGrant) {
        throw new Error("ENTITLEMENT_REVOKED_DURING_EXPORT: Pro access was lost after reservation.");
      }

      // Quota sums filtered by (userId, entitlementType, quotaPeriodKey)
      const usageAgg = await tx.usageLedger.aggregate({
        where: {
          userId,
          entitlementType,
          periodBucketKey: quotaPeriodKey,
        },
        _sum: { unitsConsumed: true },
      });

      const netUsage = usageAgg._sum.unitsConsumed ?? 0;
      if (netUsage < 0) {
        throw new Error(`CORRUPTED_LEDGER_STATE: Net usage ${netUsage} is negative.`);
      }

      return await tx.opportunityExport.update({
        where: { id: exportRecord.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          byteSize,
          contentHash,
          consumptionLedgerId: currentExport.reservationLedgerId, // Explicitly aliases the reservation row as final consumption
        },
      });
    });

    // Emit Server-Authoritative EXPORT_COMPLETED Commercial Event
    try {
      const billingPkg = await import("@buildworth/billing");
      if (billingPkg && billingPkg.recordCommercialEvent) {
        await billingPkg.recordCommercialEvent(prisma, {
          eventType: "EXPORT_COMPLETED",
          deduplicationKey: `exp_comp_${completedRecord.id}`,
          userId,
          opportunityId: opp.id,
          exportId: completedRecord.id,
          source: "EXPORT_SERVICE",
          metadata: {
            opportunitySlug,
            format,
            quotaPeriodKey,
            byteSize,
            contentHash,
            durationMs: elapsedMs,
          },
        });
      }
    } catch (err: any) {
      console.error("Commercial Event Emission Error:", err?.message || err);
    }

    return {
      success: true,
      exportRecord: completedRecord,
      buffer: outputBuffer,
      mimeType,
      filename,
      statusCode: 200,
    };
  } catch (err: any) {
    // Stage D: Failure and exactly one compensating release
    let releaseLedgerId: string | null = null;
    if (enforcement.ledgerId) {
      try {
        const releaseIdempKey = `release_${userId}_${requestKey}`;
        const existingRelease = await prisma.usageLedger.findFirst({
          where: { idempotencyKey: releaseIdempKey },
        });
        if (!existingRelease) {
          const relLedger = await prisma.usageLedger.create({
            data: {
              userId,
              entitlementType,
              unitsConsumed: -1,
              resourceId: opportunitySlug,
              actionContext: `EXPORT_RELEASE_${format}_FAILED`,
              idempotencyKey: releaseIdempKey,
              periodBucketKey: quotaPeriodKey,
            },
          });
          releaseLedgerId = relLedger.id;
        } else {
          releaseLedgerId = existingRelease.id;
        }
      } catch {}
    }

    const failureCode = err?.message?.includes("ENTITLEMENT_REVOKED")
      ? "ENTITLEMENT_REVOKED_DURING_EXPORT"
      : err?.message?.includes("TIMEOUT")
      ? "GENERATION_TIMEOUT"
      : err?.message?.includes("SIZE")
      ? "GENERATION_SIZE_EXCEEDED"
      : "GENERATION_FAILED";

    const failedRecord = await prisma.opportunityExport.update({
      where: { id: exportRecord.id },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        failureCode,
        releaseLedgerId,
      },
    });

    return {
      success: false,
      exportRecord: failedRecord,
      error: `EXPORT_GENERATION_FAILED: ${err.message || "Failed to produce export document."}`,
      statusCode: failureCode === "ENTITLEMENT_REVOKED_DURING_EXPORT" ? 403 : 500,
    };
  }
}
