const { PrismaClient } = require("@prisma/client");
const {
  buildCanonicalFounderFitPayload,
  computeCanonicalInputHash,
  calculateFounderFit,
} = require("../../scoring/dist/index.js");
const { execSync } = require("child_process");

async function runDefectCycleProof() {
  console.log("=== BuildWorth Phase 3 Defect-Cycle Proof Suite ===");
  const dbUrl =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5440/postgres?schema=public";
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  const testEmail = "audit.defect.cycle@buildworth.io";

  try {
    // 0. Setup test user, profile revision, requirements, and valid evaluation
    await prisma.user.deleteMany({ where: { email: testEmail } });
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        name: "Audit Test Founder",
        role: "FOUNDER",
        tier: "FREE",
      },
    });

    const mockProfileData = {
      userId: user.id,
      skills: [
        { skillKey: "TYPESCRIPT", proficiency: "EXPERT", isPrimary: true },
        { skillKey: "REACT", proficiency: "ADVANCED", isPrimary: false },
      ],
      domainExpertise: [
        { industryOrDomain: "DevOps & Compliance", yearsExperienceBand: "3-5 years" },
      ],
      distributionAssets: [{ assetType: "Twitter / X", audienceSizeBand: "1k-5k" }],
      preferences: {
        preferredIndustries: ["DevOps & Compliance"],
        excludedIndustries: ["Crypto"],
        preferredBusinessModels: ["SaaS"],
        targetGeographies: ["Global"],
        preferredBuyerRoles: ["VP of Engineering"],
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

    const soc2ReqData = {
      blueprintId: "bp-soc2-test-audit",
      schemaVersion: "1.0.0",
      minimumBudgetBand: "USD_1K_TO_5K",
      minimumCapacityBand: "HOURS_10_TO_20",
      minimumTeamSizeBand: "SOLO_FOUNDER",
      maxExpectedDeliveryWeeks: 4,
      requiredTechnicalRiskLevel: "MEDIUM",
      requiredRegulatoryRiskLevel: "LOW",
      requiredSalesComplexityLevel: "LOW",
      targetBuyerRoles: ["VP of Engineering"],
      targetIndustries: ["DevOps & Compliance"],
      targetGeographies: ["Global"],
      requiredSkills: [
        {
          skillKey: "TYPESCRIPT",
          minimumProficiency: "WORKING",
          preferredProficiency: "ADVANCED",
          importance: 5,
          isOutsourceable: false,
        },
      ],
    };

    const profileRevision = await prisma.founderProfileRevision.create({
      data: {
        userId: user.id,
        revisionNumber: 1,
        inputHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        skills: { create: mockProfileData.skills },
        domainExpertise: { create: mockProfileData.domainExpertise },
        distributionAssets: { create: mockProfileData.distributionAssets },
        preferences: { create: mockProfileData.preferences },
        constraints: { create: mockProfileData.constraints },
      },
    });

    const requirements = await prisma.opportunityFounderRequirements.create({
      data: {
        blueprintId: soc2ReqData.blueprintId,
        schemaVersion: soc2ReqData.schemaVersion,
        minimumBudgetBand: soc2ReqData.minimumBudgetBand,
        minimumCapacityBand: soc2ReqData.minimumCapacityBand,
        minimumTeamSizeBand: soc2ReqData.minimumTeamSizeBand,
        maxExpectedDeliveryWeeks: soc2ReqData.maxExpectedDeliveryWeeks,
        requiredTechnicalRiskLevel: soc2ReqData.requiredTechnicalRiskLevel,
        requiredRegulatoryRiskLevel: soc2ReqData.requiredRegulatoryRiskLevel,
        requiredSalesComplexityLevel: soc2ReqData.requiredSalesComplexityLevel,
        targetBuyerRoles: soc2ReqData.targetBuyerRoles,
        targetIndustries: soc2ReqData.targetIndustries,
        targetGeographies: soc2ReqData.targetGeographies,
        requiredSkills: { create: soc2ReqData.requiredSkills },
      },
    });

    const canonicalPayload = buildCanonicalFounderFitPayload(
      mockProfileData,
      soc2ReqData,
      {
        opportunityScore: 89,
        evidenceConfidence: 82,
        publicationQualityStatus: "VERIFIED",
        decisionRecommendation: "BUILD_CANDIDATE",
      },
      {
        rubricVersion: "2.0.0",
        rankingVersion: "2.0.0",
        taxonomyVersion: "1.0.0",
        profileRevisionId: profileRevision.id,
        profileRevisionInputHash: profileRevision.inputHash,
        opportunityRevisionId: requirements.blueprintId,
      },
    );

    const validHash = computeCanonicalInputHash(canonicalPayload);

    const evaluation = await prisma.founderFitEvaluation.create({
      data: {
        profileRevisionId: profileRevision.id,
        opportunityRevisionId: requirements.blueprintId,
        requirementsId: requirements.id,
        founderFitScore: 95,
        fitConfidence: 100,
        recommendationCategory: "EXCELLENT_MATCH",
        personalizedRank: 89.3,
        baseRank: 89.3,
        totalPenaltyPoints: 0,
        rubricVersion: "2.0.0",
        rankingVersion: "2.0.0",
        taxonomyVersion: "1.0.0",
        inputHash: validHash,
      },
    });

    console.log("Seeded Authoritative Evaluation ID:", evaluation.id, "Valid Hash:", validHash);

    const runAudit = (expectCode) => {
      try {
        const out = execSync("node packages/database/scripts/audit-founder-fit.js", {
          stdio: "pipe",
          env: { ...process.env, DATABASE_URL: dbUrl },
        }).toString();
        if (expectCode !== 0) throw new Error(`Expected exit code ${expectCode} but got 0: ${out}`);
        return out;
      } catch (err) {
        if (err.status !== expectCode) {
          throw new Error(
            `Expected exit code ${expectCode} but got ${err.status}: ${err.stderr || err.stdout}`,
          );
        }
        return err.stdout ? err.stdout.toString() : "";
      }
    };

    console.log("Cycle Step 1: Run clean audit against populated database -> expect exit 0");
    const out1 = runAudit(0);
    console.log("  ✓ Step 1 Passed (Clean audit exit 0)");

    console.log("Cycle Step 2: Corrupt inputHash -> expect exit 1");
    await prisma.founderFitEvaluation.update({
      where: { id: evaluation.id },
      data: { inputHash: "0000000000000000000000000000000000000000000000000000000000000000" },
    });
    runAudit(1);
    console.log("  ✓ Step 2 Passed (Corrupted hash caught, exit 1)");

    console.log("Cycle Step 3: Restore valid hash -> expect exit 0");
    await prisma.founderFitEvaluation.update({
      where: { id: evaluation.id },
      data: { inputHash: validHash },
    });
    runAudit(0);
    console.log("  ✓ Step 3 Passed (Restored hash clean, exit 0)");

    console.log(
      "Cycle Step 4: Change referenced scoring input without updating evaluation -> expect exit 1",
    );
    await prisma.founderProfileSkill.updateMany({
      where: { profileRevisionId: profileRevision.id, skillKey: "TYPESCRIPT" },
      data: { proficiency: "BASIC" },
    });
    runAudit(1);
    console.log("  ✓ Step 4 Passed (Input modification detected via mismatch, exit 1)");

    console.log("Cycle Step 5: Restore source input -> expect exit 0");
    await prisma.founderProfileSkill.updateMany({
      where: { profileRevisionId: profileRevision.id, skillKey: "TYPESCRIPT" },
      data: { proficiency: "EXPERT" },
    });
    runAudit(0);
    console.log("  ✓ Step 5 Passed (Restored source input clean, exit 0)");

    console.log("Cycle Step 6: Insert legacy det-r2-* identifier -> expect exit 1");
    await prisma.founderFitEvaluation.update({
      where: { id: evaluation.id },
      data: { inputHash: "det-r2-88-70-20.8" },
    });
    runAudit(1);
    console.log("  ✓ Step 6 Passed (Legacy identifier rejected, exit 1)");

    // Restore to clean state
    await prisma.founderFitEvaluation.update({
      where: { id: evaluation.id },
      data: { inputHash: validHash },
    });

    console.log("Cycle Step 7: Run with unavailable database -> expect exit 2");
    try {
      execSync("node packages/database/scripts/audit-founder-fit.js", {
        stdio: "pipe",
        env: {
          ...process.env,
          DATABASE_URL:
            "postgresql://postgres:wrongpassword@localhost:5999/nonexistent?connect_timeout=1",
        },
      });
      throw new Error("Expected exit code 2 for offline database");
    } catch (err) {
      if (err.status !== 2) throw new Error(`Expected status 2 but got ${err.status}`);
      console.log("  ✓ Step 7 Passed (Unavailable database returned exit 2)");
    }

    console.log("=======================================================");
    console.log("All 7 Defect-Cycle Proof Steps Passed Successfully!");
    console.log("=======================================================");
  } finally {
    await prisma.$disconnect();
  }
}

runDefectCycleProof();
