const { PrismaClient } = require("@prisma/client");
const {
  buildCanonicalFounderFitPayload,
  computeCanonicalInputHash,
  calculateFounderFit,
} = require("../../scoring/dist/index.js");

async function seedAuditEvaluation() {
  const dbUrl =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5440/postgres?schema=public";
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  const testEmail = "strict.audit.persisted@buildworth.io";

  try {
    // 0. Clean prior test records
    const existingUser = await prisma.user.findUnique({ where: { email: testEmail } });
    if (existingUser) {
      await prisma.founderFitEvaluation.deleteMany({ where: { userId: existingUser.id } });
      await prisma.founderProfileRevision.deleteMany({
        where: { profile: { userId: existingUser.id } },
      });
      await prisma.founderProfile.deleteMany({ where: { userId: existingUser.id } });
      await prisma.user.delete({ where: { id: existingUser.id } });
    }
    await prisma.opportunityFounderRequirements.deleteMany({
      where: { blueprintId: "bp-soc2-strict-audit" },
    });
    await prisma.opportunityBlueprint.deleteMany({ where: { id: "bp-soc2-strict-audit" } });
    await prisma.opportunityRevision.deleteMany({ where: { id: "rev-soc2-strict-audit-1" } });
    await prisma.opportunity.deleteMany({ where: { slug: "automated-soc2-strict-audit" } });

    // 1. User
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        name: "Strict Audit Founder",
        role: "USER",
        tier: "FREE",
      },
    });

    // 2. FounderProfile
    const profile = await prisma.founderProfile.create({
      data: {
        userId: user.id,
      },
    });

    // 3. FounderProfileRevision with sub-records
    const mockProfileData = {
      userId: user.id,
      skills: [
        { skillKey: "TYPESCRIPT", proficiency: "EXPERT", isPrimary: true },
        { skillKey: "REACT", proficiency: "ADVANCED", isPrimary: false },
        { skillKey: "POSTGRESQL", proficiency: "WORKING", isPrimary: false },
        { skillKey: "DEVOPS", proficiency: "WORKING", isPrimary: false },
      ],
      domainExpertise: [
        { industryOrDomain: "DevOps & Compliance", yearsExperienceBand: "3-5 years" },
      ],
      distributionAssets: [
        { assetType: "Twitter / X", audienceSizeBand: "1k-5k", description: "Audience" },
      ],
      preferences: {
        preferredIndustries: ["DevOps & Compliance", "B2B SaaS"],
        excludedIndustries: ["Crypto"],
        preferredBusinessModels: ["SaaS"],
        targetGeographies: ["Global"],
        preferredBuyerRoles: ["VP of Engineering", "Head of Security"],
      },
      constraints: {
        mvpBudgetBand: "USD_5K_TO_20K",
        budgetCurrency: "USD",
        availableHoursPerWeekBand: "HOURS_21_TO_35",
        teamSizeBand: "SOLO_FOUNDER",
        technicalRiskTolerance: "HIGH",
        regulatoryRiskTolerance: "MEDIUM",
        salesComplexityTolerance: "MEDIUM",
        operationalBurdenTolerance: "MEDIUM",
        fundingPreference: "BOOTSTRAP_ONLY",
      },
    };

    const profileRevision = await prisma.founderProfileRevision.create({
      data: {
        profileId: profile.id,
        revisionNumber: 1,
        inputHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        skills: { create: mockProfileData.skills },
        domainExpertise: { create: mockProfileData.domainExpertise },
        distributionAssets: { create: mockProfileData.distributionAssets },
        preference: { create: mockProfileData.preferences },
        constraint: { create: mockProfileData.constraints },
      },
    });

    await prisma.founderProfile.update({
      where: { id: profile.id },
      data: { currentProfileRevisionId: profileRevision.id },
    });

    // 4. Opportunity, Revision, and Blueprint
    const opp = await prisma.opportunity.create({
      data: {
        slug: "automated-soc2-strict-audit",
        title: "Automated SOC2 Strict Audit Collector",
        oneSentenceSummary: "Eliminates 40h audit screenshot sprints for DevOps.",
        problemStatement: "DevOps teams face 40 hours of manual SOC2 screenshot captures.",
        jobsToBeDone: ["Collect compliance screenshots", "Export audit packages"],
        proposedProduct: "Automated git-linked compliance evidence monitor",
        narrowMvpScope: ["GitHub Action PR verifier"],
        targetCustomerSegments: ["Mid-market SaaS companies"],
        economicBuyer: "VP of Engineering",
        endUser: "DevOps Engineer",
        buyingTrigger: "Upcoming SOC2 Type II audit",
        existingWorkflow: "Manual screenshots stored in Google Drive folders",
        painSeverity: "CRITICAL",
        painFrequency: "MONTHLY",
        status: "PUBLISHED",
        customerType: "B2B",
        industry: "DevOps & Compliance",
        publicationQualityStatus: "VERIFIED",
        isDemoFixture: false,
        decisionRecommendation: "BUILD_CANDIDATE",
        estimatedMvpCostMinCents: 500000,
        estimatedMvpCostMaxCents: 1200000,
        estimatedTimeToMvpMinWeeks: 4,
        estimatedTimeToMvpMaxWeeks: 8,
        estimatedMonthlyOpCostMinCents: 15000,
        estimatedMonthlyOpCostMaxCents: 30000,
        currency: "USD",
        recommendedNextExperiment: "Pre-sell 5 pilot licenses",
        majorAssumptions: ["Engineers will install GitHub app"],
        majorRisks: ["Vanta native feature expansion"],
      },
    });

    const oppRevision = await prisma.opportunityRevision.create({
      data: {
        id: "rev-soc2-strict-audit-1",
        opportunityId: opp.id,
        revisionNumber: 1,
        snapshotData: { title: opp.title },
        reasonForChange: "Initial revision",
      },
    });

    const blueprint = await prisma.opportunityBlueprint.create({
      data: {
        id: "bp-soc2-strict-audit",
        opportunityRevisionId: oppRevision.id,
        schemaVersion: "1.0.0",
        generationStatus: "SYNTHESIZED",
        calculationVersion: "1.0.0",
        decisionRuleVersion: "1.0.0",
        inputHash: "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0",
      },
    });

    // 5. OpportunityFounderRequirements
    const soc2ReqData = {
      blueprintId: blueprint.id,
      schemaVersion: "1.0.0",
      minimumBudgetBand: "USD_1K_TO_5K",
      minimumCapacityBand: "HOURS_10_TO_20",
      minimumTeamSizeBand: "SOLO_FOUNDER",
      maxExpectedDeliveryWeeks: 4,
      requiredTechnicalRiskLevel: "MEDIUM",
      requiredRegulatoryRiskLevel: "LOW",
      requiredSalesComplexityLevel: "LOW",
      targetBuyerRoles: ["VP of Engineering", "Head of Security"],
      targetIndustries: ["DevOps & Compliance", "B2B SaaS"],
      targetGeographies: ["Global"],
      requiredSkills: [
        {
          skillKey: "TYPESCRIPT",
          minimumProficiency: "WORKING",
          preferredProficiency: "ADVANCED",
          importance: 5,
          isOutsourceable: false,
        },
        {
          skillKey: "POSTGRESQL",
          minimumProficiency: "BASIC",
          preferredProficiency: "WORKING",
          importance: 4,
          isOutsourceable: true,
        },
      ],
    };

    const requirements = await prisma.opportunityFounderRequirements.create({
      data: {
        blueprintId: blueprint.id,
        schemaVersion: soc2ReqData.schemaVersion,
        minimumBudgetBand: "USD_1K_TO_5K",
        minimumCapacityBand: "HOURS_10_TO_20",
        minimumTeamSizeBand: "SOLO_FOUNDER",
        maxExpectedDeliveryWeeks: 4,
        requiredTechnicalRiskLevel: "MEDIUM",
        requiredRegulatoryRiskLevel: "LOW",
        requiredSalesComplexityLevel: "LOW",
        targetBuyerRoles: soc2ReqData.targetBuyerRoles,
        targetIndustries: soc2ReqData.targetIndustries,
        targetGeographies: soc2ReqData.targetGeographies,
        requiredSkills: { create: soc2ReqData.requiredSkills },
      },
    });

    // 6. Calculate Founder Fit using canonical calculator
    const fitResult = calculateFounderFit(
      mockProfileData,
      soc2ReqData,
      {
        opportunityScore: 89,
        evidenceConfidence: 82,
        publicationQualityStatus: "VERIFIED",
        decisionRecommendation: "BUILD_CANDIDATE",
      },
      {
        calculatorVersion: "2.0.1",
        rubricVersion: "2.0.0",
        rankingVersion: "2.0.0",
        taxonomyVersion: "1.0.0",
        profileRevisionId: profileRevision.id,
        profileRevisionInputHash: profileRevision.inputHash,
        opportunityRevisionId: blueprint.id,
      },
    );

    // 7. Persist FounderFitEvaluation with dimension records
    const evaluation = await prisma.founderFitEvaluation.create({
      data: {
        userId: user.id,
        profileRevisionId: profileRevision.id,
        opportunityRevisionId: oppRevision.id,
        blueprintId: blueprint.id,
        requirementsId: requirements.id,
        founderFitScore: fitResult.founderFitScore,
        fitConfidence: fitResult.fitConfidence,
        recommendationCategory: fitResult.recommendationCategory,
        personalizedRank: fitResult.personalizedRank,
        baseRank: fitResult.baseRank,
        totalPenaltyPoints: fitResult.penalties.reduce((acc, p) => acc + p.penaltyPoints, 0),
        rubricVersion: "2.0.0",
        rankingVersion: "2.0.0",
        taxonomyVersion: "1.0.0",
        inputHash: fitResult.inputHash,
        dimensions: {
          create: fitResult.dimensions.map((d) => ({
            dimensionName: d.name,
            score: d.score,
            maxScore: d.maxScore,
            status: d.status,
            explanation: d.explanation,
            matchedRequirements: d.matchedRequirements || [],
            missingRequirements: d.missingRequirements || [],
          })),
        },
      },
    });

    console.log("Successfully seeded complete authoritative FounderFitEvaluation:");
    console.log("  Evaluation ID  :", evaluation.id);
    console.log("  Input Hash     :", evaluation.inputHash);
    console.log("  Founder Fit    :", evaluation.founderFitScore);
    console.log("  Personalized   :", evaluation.personalizedRank);
  } finally {
    await prisma.$disconnect();
  }
}

seedAuditEvaluation().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
