import { createHash } from "crypto";
import { FounderProfileData } from "@buildworth/shared";

export function computeProfileInputHash(data: FounderProfileData): string {
  const canonical = JSON.stringify({
    userId: data.userId,
    skills: data.skills
      .map((s) => ({ k: s.skillKey, p: s.proficiency, pri: !!s.isPrimary }))
      .sort((a, b) => a.k.localeCompare(b.k)),
    domains: data.domainExpertise
      .map((d) => ({ i: d.industryOrDomain, y: d.yearsExperienceBand }))
      .sort((a, b) => a.i.localeCompare(b.i)),
    assets: data.distributionAssets
      .map((a) => ({ t: a.assetType, d: a.description }))
      .sort((a, b) => a.t.localeCompare(b.t)),
    preferences: {
      ind: [...data.preferences.preferredIndustries].sort(),
      geo: [...data.preferences.targetGeographies].sort(),
      buyers: [...data.preferences.preferredBuyerRoles].sort(),
    },
    constraints: {
      budget: data.constraints.mvpBudgetBand,
      cap: data.constraints.availableHoursPerWeekBand,
      team: data.constraints.teamSizeBand,
      tech: data.constraints.technicalRiskTolerance,
      reg: data.constraints.regulatoryRiskTolerance,
      fund: data.constraints.fundingPreference,
    },
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export async function createOrUpdateFounderProfileTransaction(
  prismaClient: any,
  userId: string,
  input: FounderProfileData,
): Promise<{ profileId: string; revisionId: string; revisionNumber: number }> {
  return await prismaClient.$transaction(async (tx: any) => {
    const lockKey =
      Math.abs(userId.split("").reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)) %
      2147483647;
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${lockKey})`);

    let profile = await tx.founderProfile.findUnique({
      where: { userId },
      include: {
        revisions: { orderBy: { revisionNumber: "desc" }, take: 1 },
      },
    });

    if (!profile) {
      profile = await tx.founderProfile.create({
        data: { userId },
        include: { revisions: true },
      });
    }

    const nextRevisionNumber =
      ((profile.revisions && profile.revisions[0]?.revisionNumber) ?? 0) + 1;
    const inputHash = computeProfileInputHash(input);

    const revision = await tx.founderProfileRevision.create({
      data: {
        profileId: profile.id,
        revisionNumber: nextRevisionNumber,
        inputHash,
        skills: {
          create: input.skills.map((s) => ({
            skillKey: s.skillKey,
            proficiency: s.proficiency,
            isPrimary: !!s.isPrimary,
          })),
        },
        domainExpertise: {
          create: input.domainExpertise.map((d) => ({
            industryOrDomain: d.industryOrDomain,
            yearsExperienceBand: d.yearsExperienceBand,
            workflowContext: d.workflowContext,
          })),
        },
        distributionAssets: {
          create: input.distributionAssets.map((a) => ({
            assetType: a.assetType,
            audienceSizeBand: a.audienceSizeBand,
            description: a.description,
          })),
        },
        preference: {
          create: {
            preferredIndustries: input.preferences.preferredIndustries,
            excludedIndustries: input.preferences.excludedIndustries,
            preferredBusinessModels: input.preferences.preferredBusinessModels,
            targetGeographies: input.preferences.targetGeographies,
            preferredBuyerRoles: input.preferences.preferredBuyerRoles,
            preferredSalesMotion: input.preferences.preferredSalesMotion,
          },
        },
        constraint: {
          create: {
            mvpBudgetBand: input.constraints.mvpBudgetBand,
            budgetCurrency: input.constraints.budgetCurrency || "USD",
            availableHoursPerWeekBand: input.constraints.availableHoursPerWeekBand,
            teamSizeBand: input.constraints.teamSizeBand,
            maxTimeToMvpWeeks: input.constraints.maxTimeToMvpWeeks,
            technicalRiskTolerance: input.constraints.technicalRiskTolerance,
            regulatoryRiskTolerance: input.constraints.regulatoryRiskTolerance,
            salesComplexityTolerance: input.constraints.salesComplexityTolerance,
            operationalBurdenTolerance: input.constraints.operationalBurdenTolerance,
            fundingPreference: input.constraints.fundingPreference,
          },
        },
      },
    });

    await tx.founderProfile.update({
      where: { id: profile.id },
      data: { currentProfileRevisionId: revision.id },
    });

    await tx.auditLog.create({
      data: {
        action: "FOUNDER_PROFILE_REVISION_CREATED",
        entityType: "FOUNDER_PROFILE",
        entityId: profile.id,
        userId,
        reason: `Created Founder Profile Revision #${nextRevisionNumber}`,
      },
    });

    return {
      profileId: profile.id,
      revisionId: revision.id,
      revisionNumber: nextRevisionNumber,
    };
  });
}

export async function deleteFounderProfileTransaction(
  prismaClient: any,
  userId: string,
): Promise<void> {
  await prismaClient.$transaction(async (tx: any) => {
    const profile = await tx.founderProfile.findUnique({ where: { userId } });
    if (!profile) return;

    await tx.founderProfile.delete({ where: { id: profile.id } });

    await tx.auditLog.create({
      data: {
        action: "FOUNDER_PROFILE_DELETED",
        entityType: "FOUNDER_PROFILE",
        entityId: profile.id,
        userId,
        reason: "User requested profile deletion under data minimization policy",
      },
    });
  });
}
