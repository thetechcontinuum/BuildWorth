import { prisma } from "./client.js";

/**
 * Loads the complete decision-grade venture blueprint for an opportunity by its slug or ID.
 * Returns authoritative revision-owned relational models.
 */
export async function getAuthoritativeOpportunityBlueprint(slugOrId: string): Promise<any> {
  const opportunity = await prisma.opportunity.findFirst({
    where: {
      OR: [{ slug: slugOrId }, { id: slugOrId }],
    },
    include: {
      revisions: {
        where: { id: { not: undefined } },
        orderBy: { revisionNumber: "desc" },
        take: 1,
        include: {
          blueprint: {
            include: {
              customerSegments: true,
              mvpFeatures: { orderBy: { orderIndex: "asc" } },
              competitors: true,
              financialScenarios: true,
              costLineItems: true,
              benefitDrivers: true,
              risks: true,
              assumptions: true,
              validationExperiments: { orderBy: { orderPriority: "asc" } },
              decisionEvaluation: true,
            },
          },
          evidenceLinks: {
            include: {
              normalizedSignal: {
                include: { source: true },
              },
            },
          },
        },
      },
      scorecards: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { dimensions: true },
      },
    },
  });

  return opportunity;
}
