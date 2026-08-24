import { prisma } from "./client.js";

export interface CreateAuditLogInput {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  evidenceId?: string | null;
  opportunityRevisionId?: string | null;
  previousState?: string | null;
  newState?: string | null;
  reason?: string | null;
  verificationMethod?: string | null;
  confidenceRubricVersion?: string | null;
  publicationGateVersion?: string | null;
  evidenceIdsUsed?: string[];
  previousConfidence?: number | null;
  newConfidence?: number | null;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
}

/**
 * Records an immutable audit log entry for evidence verification and confidence recalculations.
 */
export async function recordAuditLog(input: CreateAuditLogInput) {
  try {
    return await prisma.auditLog.create({
      data: {
        userId: input.userId || null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        evidenceId: input.evidenceId || null,
        opportunityRevisionId: input.opportunityRevisionId || null,
        previousState: input.previousState || null,
        newState: input.newState || null,
        reason: input.reason || null,
        verificationMethod: input.verificationMethod || null,
        confidenceRubricVersion: input.confidenceRubricVersion || "2.0.0",
        publicationGateVersion: input.publicationGateVersion || "2.0.0",
        evidenceIdsUsed: input.evidenceIdsUsed || [],
        previousConfidence:
          input.previousConfidence !== undefined ? input.previousConfidence : null,
        newConfidence: input.newConfidence !== undefined ? input.newConfidence : null,
        details: input.details ? (input.details as any) : undefined,
        ipAddress: input.ipAddress || null,
      },
    });
  } catch (err) {
    console.error("Failed to record audit log:", err);
    return null;
  }
}
