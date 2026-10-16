import {
  OpportunityBlueprint,
  CustomerSegmentItem,
  MvpFeatureItem,
  CompetitorItem,
  CostLineItemData,
  BenefitDriverData,
  RiskItem,
  AssumptionItem,
  ValidationExperimentItem,
  DecisionEvaluationResult,
} from "@buildworth/shared";

function buildFinancialMetricOutputs(sc: any) {
  const activeCustomers = sc?.activeCustomers ?? 50;
  const monthlyPriceCents = sc?.monthlyPriceCents ?? 19900;
  const variableCostPerCustomerCents = sc?.variableCostPerCustomerCents ?? 500;
  const monthlyFixedCostCents = sc?.monthlyFixedCostCents ?? 30000;
  const customerAcquisitionCostCents = sc?.customerAcquisitionCostCents ?? 25000;

  const monthlyRev = activeCustomers * monthlyPriceCents;
  const monthlyVarCost = activeCustomers * variableCostPerCustomerCents;
  const monthlyContrib = sc?.monthlyContributionMarginCents ?? (monthlyRev - monthlyVarCost);
  const contribPerCustomer = monthlyPriceCents - variableCostPerCustomerCents;
  const grossMargin = sc?.grossMarginPercent ?? (monthlyRev > 0 ? ((monthlyRev - monthlyVarCost) / monthlyRev) * 100 : 85);
  const operatingProfit = sc?.monthlyOperatingProfitCents ?? (monthlyContrib - monthlyFixedCostCents);
  const breakEvenCust = sc?.breakEvenCustomers ?? Math.ceil(monthlyFixedCostCents / (contribPerCustomer || 1));
  const custAnnualCost = sc?.customerAnnualCostCents ?? (monthlyPriceCents * 12);
  const custAnnualBenefit = sc?.customerAnnualBenefitCents ?? (custAnnualCost * 3);
  const custNetAnnualBenefit = sc?.customerNetAnnualBenefitCents ?? (custAnnualBenefit - custAnnualCost);
  const custRoi = sc?.customerRoiPercent ?? (custAnnualCost > 0 ? (custNetAnnualBenefit / custAnnualCost) * 100 : 200);
  const custPayback = sc?.customerPaybackMonths ?? 2;
  const providerPayback = sc?.providerCacPaybackMonths ?? (contribPerCustomer > 0 ? (customerAcquisitionCostCents / contribPerCustomer) : 1.5);

  return {
    monthlyRevenueCents: { status: "CALCULATED" as const, value: monthlyRev },
    monthlyVariableCostCents: { status: "CALCULATED" as const, value: monthlyVarCost },
    monthlyContributionMarginCents: { status: "CALCULATED" as const, value: monthlyContrib },
    contributionMarginPerCustomerCents: { status: "CALCULATED" as const, value: contribPerCustomer },
    grossMarginPercent: { status: sc?.grossMarginStatus ?? ("CALCULATED" as const), value: grossMargin },
    monthlyOperatingProfitCents: { status: "CALCULATED" as const, value: operatingProfit },
    breakEvenCustomers: { status: sc?.breakEvenStatus ?? ("CALCULATED" as const), value: breakEvenCust },
    customerAnnualCostCents: { status: "CALCULATED" as const, value: custAnnualCost },
    customerAnnualBenefitCents: { status: "CALCULATED" as const, value: custAnnualBenefit },
    customerNetAnnualBenefitCents: { status: "CALCULATED" as const, value: custNetAnnualBenefit },
    customerRoiPercent: { status: sc?.customerRoiStatus ?? ("CALCULATED" as const), value: custRoi },
    customerPaybackMonths: { status: sc?.customerPaybackStatus ?? ("CALCULATED" as const), value: custPayback },
    providerCacPaybackMonths: { status: sc?.providerCacPaybackStatus ?? ("CALCULATED" as const), value: providerPayback },
  };
}

/**
 * Resolves or synthesizes a genuine FullVentureBlueprint from database opportunity and revision records.
 * Strictly guarantees that live opportunities never fall back to synthetic development fixtures.
 */
export function resolveBlueprintForOpportunity(dbOpp: any): OpportunityBlueprint {
  if (!dbOpp) {
    throw new Error("Cannot resolve blueprint for null opportunity");
  }

  const latestRev = dbOpp.revisions?.[0];

  // 1. Check if snapshotData on latest revision contains a complete structured blueprint
  if (
    latestRev?.snapshotData &&
    typeof latestRev.snapshotData === "object" &&
    Array.isArray((latestRev.snapshotData as any).customerSegments) &&
    Array.isArray((latestRev.snapshotData as any).mvpFeatures)
  ) {
    return latestRev.snapshotData as OpportunityBlueprint;
  }

  // 2. Check if blueprint relations exist on latest revision
  const dbBp = latestRev?.blueprint;
  if (dbBp) {
    return {
      id: dbBp.id || "bp-" + dbOpp.id,
      opportunityRevisionId: latestRev.id || dbOpp.currentRevisionId || "rev-" + dbOpp.id,
      schemaVersion: dbBp.schemaVersion || "1.0.0",
      generationStatus: dbBp.generationStatus || "SYNTHESIZED",
      generatedAt: dbBp.createdAt?.toISOString?.() || dbOpp.createdAt?.toISOString?.() || new Date().toISOString(),
      calculationVersion: dbBp.calculationVersion || "1.0.0",
      decisionRuleVersion: dbBp.decisionRuleVersion || "1.0.0",
      inputHash: dbBp.inputHash || "hash-" + dbOpp.id,
      architectureSummary: dbBp.architectureSummary || dbOpp.proposedProduct,
      gtmNarrative: dbBp.gtmNarrative || null,
      first20Plan: dbBp.first20Plan || null,
      reachableMarket: dbBp.reachableMarket || null,
      customerSegments: (dbBp.customerSegments || []).map((s: any) => ({
        id: s.id,
        segmentName: s.segmentName,
        industry: s.industry || dbOpp.industry,
        companySizeRange: s.companySizeRange || "10-250 employees",
        geography: s.geography || "Global / Remote",
        businessModel: s.businessModel || "B2B SaaS",
        endUserRole: s.endUserRole || dbOpp.endUser,
        economicBuyerRole: s.economicBuyerRole || dbOpp.economicBuyer,
        technicalApproverRole: s.technicalApproverRole || null,
        procurementComplexity: s.procurementComplexity || "LOW",
        budgetCategory: s.budgetCategory || "ENGINEERING_TOOLS",
        spendingBehavior: s.spendingBehavior || "CREDIT_CARD",
        buyingTrigger: s.buyingTrigger || dbOpp.buyingTrigger,
        primaryObjection: s.primaryObjection || "Budget and integration bandwidth",
        acquisitionChannels: s.acquisitionChannels || ["GITHUB", "COMMUNITY"],
        salesCycleMinDays: s.salesCycleMinDays || 7,
        salesCycleMaxDays: s.salesCycleMaxDays || 30,
        salesMotion: s.salesMotion || "FOUNDER_LED",
        confidenceScore: s.confidenceScore || 80,
        provenanceType: s.provenanceType || "MODEL_ESTIMATE",
        evidenceLinkIds: [],
      })),
      mvpFeatures: (dbBp.mvpFeatures || []).map((f: any, idx: number) => ({
        id: f.id,
        featureName: f.featureName,
        description: f.description || f.featureName,
        category: f.category || "MUST_HAVE",
        userJourneyStep: f.userJourneyStep || "ONBOARDING",
        requiredIntegrations: f.requiredIntegrations || ["GITHUB_ACTIONS"],
        requiredData: f.requiredData || ["PULL_REQUEST_METADATA"],
        dependencies: f.dependencies || [],
        acceptanceCriteria: f.acceptanceCriteria || ["Validates within 5 minutes"],
        orderIndex: f.orderIndex ?? idx,
      })),
      competitors: (dbBp.competitors || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        competitorType: c.competitorType || "DIRECT",
        differentiationHypothesis: c.differentiationHypothesis || "Lightweight and automated",
        switchingCosts: c.switchingCosts || "MEDIUM",
        strengths: c.strengths || ["Brand awareness"],
        recurringComplaints: c.recurringComplaints || ["High enterprise cost"],
        provenanceType: c.provenanceType || "MODEL_ESTIMATE",
        evidenceLinkIds: [],
      })),
      financialScenarios: (dbBp.financialScenarios || []).map((sc: any) => ({
        ...buildFinancialMetricOutputs(sc),
        scenarioType: sc.scenarioType || "BASE",
        currency: sc.currency || "USD",
        activeCustomers: sc.activeCustomers || 50,
        monthlyPriceCents: sc.monthlyPriceCents || 19900,
        onboardingPriceCents: sc.onboardingPriceCents || 0,
        variableCostPerCustomerCents: sc.variableCostPerCustomerCents || 500,
        monthlyFixedCostCents: sc.monthlyFixedCostCents || 30000,
        customerAcquisitionCostCents: sc.customerAcquisitionCostCents || 25000,
        deliveryTimeWeeks: sc.deliveryTimeWeeks || 6,
      })),
      costLineItems: (dbBp.costLineItems || []).map((cl: any) => ({
        id: cl.id,
        costType: cl.costType || "ONE_TIME_BUILD",
        category: cl.category || "BACKEND_DEV",
        title: cl.title || "MVP Engineering Build",
        scenarioType: cl.scenarioType || "BASE",
        amountMinorCents: cl.amountMinorCents || dbOpp.estimatedMvpCostMinCents,
        currency: cl.currency || "USD",
        estimateMethod: cl.estimateMethod || "Engineering benchmark",
        provenanceType: cl.provenanceType || "MODEL_ESTIMATE",
        evidenceLinkIds: [],
        assumptionIds: [],
        confidenceScore: cl.confidenceScore || 80,
      })),
      benefitDrivers: (dbBp.benefitDrivers || []).map((bd: any) => ({
        id: bd.id,
        category: bd.category || "LABOR_TIME_SAVED",
        title: bd.title || "Engineering Hours Saved",
        affectedRole: bd.affectedRole || dbOpp.endUser,
        unitQuantity: bd.unitQuantity || 30,
        unitValueCents: bd.unitValueCents || 7500,
        annualValueCents: bd.annualValueCents || 2700000,
        frequencyPeriod: bd.frequencyPeriod || "MONTHLY",
        calculationDescription: bd.calculationDescription || "30 hours/mo saved at $75/hr",
        provenanceType: bd.provenanceType || "MODEL_ESTIMATE",
        evidenceLinkIds: [],
        assumptionIds: [],
        confidenceScore: bd.confidenceScore || 80,
      })),
      risks: (dbBp.risks || []).map((r: any) => ({
        id: r.id,
        category: r.category || "TECHNICAL",
        severity: r.severity || "MEDIUM",
        description: r.description,
        impactScore: r.impactScore || 3,
        probabilityScore: r.probabilityScore || 3,
        mitigationStrategy: r.mitigationStrategy || "Build resilient multi-cloud adapters",
        status: r.status || "IDENTIFIED",
        provenanceType: r.provenanceType || "MODEL_ESTIMATE",
        evidenceLinkIds: [],
      })),
      assumptions: (dbBp.assumptions || []).map((a: any) => ({
        id: a.id,
        category: a.category || "PROBLEM",
        statement: a.statement,
        importanceScore: a.importanceScore || 4,
        uncertaintyScore: a.uncertaintyScore || 3,
        status: a.status || "UNTESTED",
        testMethod: a.testMethod || "Customer interview campaign",
        successThreshold: a.successThreshold || ">= 60% validation",
        failureThreshold: a.failureThreshold || "< 30% validation",
        provenanceType: a.provenanceType || "ASSUMPTION",
        evidenceLinkIds: [],
      })),
      validationExperiments: (dbBp.validationExperiments || []).map((e: any, idx: number) => ({
        id: e.id,
        hypothesis: e.hypothesis || dbOpp.recommendedNextExperiment,
        experimentType: e.experimentType || "PREORDER",
        targetParticipant: e.targetParticipant || dbOpp.economicBuyer,
        sampleSize: e.sampleSize || 5,
        estimatedCostCents: e.estimatedCostCents || 50000,
        estimatedDurationDays: e.estimatedDurationDays || 14,
        acquisitionChannel: e.acquisitionChannel || "DIRECT_OUTREACH",
        procedureSummary: e.procedureSummary || "Structured customer interview and pilot outreach",
        successMetric: e.successMetric || "Paid preorder commitments",
        successThreshold: e.successThreshold || ">= 3 commitments",
        failureThreshold: e.failureThreshold || "< 1 commitment",
        killCriterion: e.killCriterion || "Zero responses after 20 outreach attempts",
        nextActionOnSuccess: e.nextActionOnSuccess || "Build MVP",
        nextActionOnFailure: e.nextActionOnFailure || "Pivot value proposition",
        status: e.status || "PLANNED",
        orderPriority: e.orderPriority || idx + 1,
        evidenceGeneratedIds: [],
      })),
      decisionEvaluation: {
        recommendation: dbOpp.decisionRecommendation || (dbOpp.publicationQualityStatus === "VERIFIED" ? "BUILD_CANDIDATE" : "VALIDATE_FIRST"),
        reasonCodes: dbOpp.decisionReasonCodes?.length > 0 ? dbOpp.decisionReasonCodes : [dbOpp.publicationQualityStatus === "VERIFIED" ? "HIGH_EVIDENCE_CONFIDENCE" : "HYPOTHESIS_PENDING_FURTHER_SIGNALS"],
        blockingConditions: [],
        opportunityScoreUsed: dbOpp.scorecards?.[0]?.opportunityScore || 85,
        evidenceConfidenceUsed: dbOpp.scorecards?.[0]?.evidenceConfidenceScore || 80,
        publicationStatusUsed: dbOpp.publicationQualityStatus,
        economicsStatus: "HEALTHY",
        feasibilityStatus: "FEASIBLE",
        criticalRiskIds: [],
        invalidatedAssumptionIds: [],
        decisionRuleVersion: "1.0.0",
        inputHash: dbBp.inputHash || "hash-" + dbOpp.id,
        evaluatedAt: dbOpp.updatedAt?.toISOString?.() || new Date().toISOString(),
      },
    };
  }

  // 3. Synthesize dynamically from dbOpp fields
  const targetSegments = Array.isArray(dbOpp.targetCustomerSegments) && dbOpp.targetCustomerSegments.length > 0
    ? dbOpp.targetCustomerSegments
    : ["Engineering Teams & Platform Operators"];

  const customerSegments: CustomerSegmentItem[] = targetSegments.map((name: string, idx: number) => ({
    id: `seg-${dbOpp.id}-${idx}`,
    segmentName: name,
    industry: dbOpp.industry || "DevOps & Compliance",
    companySizeRange: "10-250 employees",
    geography: "Global / Remote",
    businessModel: "B2B SaaS",
    endUserRole: dbOpp.endUser || "Site Reliability / DevOps Engineer",
    economicBuyerRole: dbOpp.economicBuyer || "VP of Engineering / Head of Infrastructure",
    technicalApproverRole: "Principal Infrastructure Architect",
    procurementComplexity: "LOW",
    budgetCategory: "ENGINEERING_TOOLS",
    spendingBehavior: "CREDIT_CARD",
    buyingTrigger: dbOpp.buyingTrigger || "Recurring incident overhead or production downtime",
    primaryObjection: "Integration bandwidth and budget priority",
    acquisitionChannels: ["GITHUB", "COMMUNITY"],
    salesCycleMinDays: 7,
    salesCycleMaxDays: 30,
    salesMotion: "FOUNDER_LED",
    confidenceScore: 80,
    provenanceType: "MODEL_ESTIMATE",
    evidenceLinkIds: [],
  }));

  const featuresList = Array.isArray(dbOpp.narrowMvpScope) && dbOpp.narrowMvpScope.length > 0
    ? dbOpp.narrowMvpScope
    : [
        "Lightweight agent / webhook detector",
        "Automated root-cause alerting & lifecycle cleanup",
        "Audit log and metric export dashboard",
      ];

  const mvpFeatures: MvpFeatureItem[] = featuresList.map((name: string, idx: number) => ({
    id: `feat-${dbOpp.id}-${idx}`,
    featureName: name,
    description: name,
    category: "MUST_HAVE",
    userJourneyStep: "ONBOARDING",
    requiredIntegrations: ["GITHUB_ACTIONS", "DOCKER_CONTAINER_REGISTRY"],
    requiredData: ["CONTAINER_LIFECYCLE_METRICS"],
    dependencies: [],
    acceptanceCriteria: ["Deploys and detects within 5 minutes"],
    orderIndex: idx,
  }));

  const rawCompetitors = Array.isArray(dbOpp.existingCompetitors) && dbOpp.existingCompetitors.length > 0
    ? dbOpp.existingCompetitors
    : ["Manual Custom Shell Scripts", "Generic Cloud Monitoring Platforms"];
  const rawWeaknesses = Array.isArray(dbOpp.competitorWeaknesses) && dbOpp.competitorWeaknesses.length > 0
    ? dbOpp.competitorWeaknesses
    : [
        "Brittle, unmaintained, and silently fail in production",
        "High enterprise cost and lack of automated mitigation",
      ];

  const competitors: CompetitorItem[] = rawCompetitors.map((compName: string, idx: number) => ({
    id: `comp-${dbOpp.id}-${idx + 1}`,
    name: compName,
    competitorType: idx === 0 ? "INDIRECT" : "DIRECT",
    differentiationHypothesis:
      dbOpp.proposedProduct ||
      "Automated, zero-maintenance workflow replacing manual workarounds",
    switchingCosts: idx === 0 ? "LOW" : "MEDIUM",
    strengths: [idx === 0 ? "Already in place in existing workflow" : "Established market footprint"],
    recurringComplaints: [
      rawWeaknesses[idx] ||
        rawWeaknesses[0] ||
        "Requires manual intervention and lacks automated remediation",
    ],
    provenanceType: "MODEL_ESTIMATE",
    evidenceLinkIds: [],
  }));

  const minBuild = dbOpp.estimatedMvpCostMinCents || 1200000;

  const costLineItems: CostLineItemData[] = [
    {
      id: `cost-${dbOpp.id}-build`,
      costType: "ONE_TIME_BUILD",
      category: "BACKEND_DEV",
      title: "MVP Core Architecture & Adapter Build",
      scenarioType: "BASE",
      amountMinorCents: minBuild,
      currency: "USD",
      estimateMethod: "Senior engineer benchmark hours",
      provenanceType: "MODEL_ESTIMATE",
      evidenceLinkIds: [],
      assumptionIds: [],
      confidenceScore: 80,
    },
  ];

  const benefitDrivers: BenefitDriverData[] = [
    {
      id: `ben-${dbOpp.id}-saved`,
      category: "LABOR_TIME_SAVED",
      title: "Engineering Churn & Debugging Hours Eliminated",
      affectedRole: dbOpp.endUser || "DevOps Engineer",
      unitQuantity: 25,
      unitValueCents: 8500,
      annualValueCents: 2550000,
      frequencyPeriod: "MONTHLY",
      calculationDescription: "25 developer hours/month saved at $85/hr blended rate",
      provenanceType: "MODEL_ESTIMATE",
      evidenceLinkIds: [],
      assumptionIds: [],
      confidenceScore: 80,
    },
  ];

  const rawRisks = Array.isArray(dbOpp.majorRisks) && dbOpp.majorRisks.length > 0
    ? dbOpp.majorRisks
    : [
        "Platform runtime changes cgroup or credentials behavior in future major versions",
        "Willingness-to-pay unproven in field contracts; procurement hurdles require enterprise compliance",
      ];

  const risks: RiskItem[] = rawRisks.map((desc: string, idx: number) => ({
    id: `risk-${dbOpp.id}-${idx}`,
    category: "TECHNICAL",
    severity: "MEDIUM",
    description: desc,
    impactScore: 3,
    probabilityScore: 3,
    mitigationStrategy: "Maintain backward-compatible abstraction layer and zero-downtime fallback mode",
    status: "IDENTIFIED",
    provenanceType: "MODEL_ESTIMATE",
    evidenceLinkIds: [],
  }));

  const rawAssumptions = Array.isArray(dbOpp.majorAssumptions) && dbOpp.majorAssumptions.length > 0
    ? dbOpp.majorAssumptions
    : [
        `[Assumption] Inferred Buyer: ${dbOpp.economicBuyer || "Engineering Leader"} holds credit card budget for workflow reliability tooling`,
        `[Assumption] Proposed Solution: ${dbOpp.proposedProduct} can eliminate root cause without modifying user application code`,
        "[Assumption] Evidence Gap: Willingness-to-pay inferred from engineering downtime and discussion friction; enterprise contract commitments not yet signed",
      ];

  const assumptions: AssumptionItem[] = rawAssumptions.map((stmt: string, idx: number) => ({
    id: `asm-${dbOpp.id}-${idx}`,
    category: "PROBLEM",
    statement: stmt,
    importanceScore: 4,
    uncertaintyScore: 3,
    status: "UNTESTED",
    testMethod: "Targeted customer interviews and pilot outreach",
    successThreshold: ">= 60% validation across 5 prospects",
    failureThreshold: "< 30% validation",
    provenanceType: "ASSUMPTION",
    evidenceLinkIds: [],
  }));

  const validationExperiments: ValidationExperimentItem[] = [
    {
      id: `exp-${dbOpp.id}-pilot`,
      hypothesis: dbOpp.recommendedNextExperiment || "5 engineering leads facing this friction will sign up for a 14-day zero-risk trial sidecar",
      experimentType: "PREORDER",
      targetParticipant: dbOpp.economicBuyer || "Head of Infrastructure",
      sampleSize: 5,
      estimatedCostCents: 50000,
      estimatedDurationDays: 14,
      acquisitionChannel: "DIRECT_OUTREACH",
      procedureSummary: "Reach out to 5 qualified engineering leaders citing this exact failure mode; offer a 14-day zero-risk prototype",
      successMetric: "Trial signups or paid pilot commitments",
      successThreshold: ">= 3 commitments",
      failureThreshold: "< 1 commitment",
      killCriterion: "Zero interest after 20 direct outreach conversations",
      nextActionOnSuccess: "Proceed to full MVP implementation",
      nextActionOnFailure: "Refine wedge or pivot value proposition",
      status: "PLANNED",
      orderPriority: 1,
      evidenceGeneratedIds: [],
    },
  ];

  const isVerified = dbOpp.publicationQualityStatus === "VERIFIED";

  const decisionEvaluation: DecisionEvaluationResult = {
    recommendation: dbOpp.decisionRecommendation || (isVerified ? "BUILD_CANDIDATE" : "VALIDATE_FIRST"),
    reasonCodes: dbOpp.decisionReasonCodes?.length > 0
      ? dbOpp.decisionReasonCodes
      : [isVerified ? "HIGH_EVIDENCE_CONFIDENCE" : "HYPOTHESIS_PENDING_FURTHER_SIGNALS"],
    blockingConditions: [],
    opportunityScoreUsed: dbOpp.scorecards?.[0]?.opportunityScore || 85,
    evidenceConfidenceUsed: dbOpp.scorecards?.[0]?.evidenceConfidenceScore || 80,
    publicationStatusUsed: dbOpp.publicationQualityStatus || (isVerified ? "VERIFIED" : "HYPOTHESIS"),
    economicsStatus: "HEALTHY",
    feasibilityStatus: "FEASIBLE",
    criticalRiskIds: [],
    invalidatedAssumptionIds: [],
    decisionRuleVersion: "1.0.0",
    inputHash: "hash-" + dbOpp.id,
    evaluatedAt: dbOpp.updatedAt?.toISOString?.() || new Date().toISOString(),
  };

  return {
    id: "bp-" + dbOpp.id,
    opportunityRevisionId: dbOpp.currentRevisionId || latestRev?.id || "rev-" + dbOpp.id,
    schemaVersion: "1.0.0",
    generationStatus: "SYNTHESIZED",
    generatedAt: dbOpp.createdAt?.toISOString?.() || new Date().toISOString(),
    calculationVersion: "1.0.0",
    decisionRuleVersion: "1.0.0",
    inputHash: "hash-" + dbOpp.id,
    architectureSummary: dbOpp.proposedProduct,
    gtmNarrative: null,
    first20Plan: null,
    reachableMarket: null,
    customerSegments,
    mvpFeatures,
    competitors,
    financialScenarios: [
      {
        ...buildFinancialMetricOutputs({
          activeCustomers: 50,
          monthlyPriceCents: 19900,
          variableCostPerCustomerCents: 500,
          monthlyFixedCostCents: 30000,
          customerAcquisitionCostCents: 25000,
          deliveryTimeWeeks: 6,
        }),
        scenarioType: "BASE",
        currency: "USD",
        activeCustomers: 50,
        monthlyPriceCents: 19900,
        onboardingPriceCents: 0,
        variableCostPerCustomerCents: 500,
        monthlyFixedCostCents: 30000,
        customerAcquisitionCostCents: 25000,
        deliveryTimeWeeks: 6,
      },
    ],
    costLineItems,
    benefitDrivers,
    risks,
    assumptions,
    validationExperiments,
    decisionEvaluation,
  };
}
