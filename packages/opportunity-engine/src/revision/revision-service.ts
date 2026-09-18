import { createHash } from "crypto";
import {
  CustomerSegmentItem,
  MvpFeatureItem,
  CompetitorItem,
  CostLineItemData,
  BenefitDriverData,
  RiskItem,
  AssumptionItem,
  ValidationExperimentItem,
  FinancialScenarioInput,
} from "@buildworth/shared";
import { calculateScenarioMetrics, evaluateDecisionRecommendation } from "@buildworth/scoring";

export interface CreateRevisionInput {
  opportunityId: string;
  reasonForChange: string;
  architectureSummary?: string | null;
  gtmNarrative?: any;
  first20Plan?: any;
  reachableMarket?: any;
  customerSegments: CustomerSegmentItem[];
  mvpFeatures: MvpFeatureItem[];
  competitors: CompetitorItem[];
  scenarios: FinancialScenarioInput[];
  costs: CostLineItemData[];
  benefits: BenefitDriverData[];
  risks: RiskItem[];
  assumptions: AssumptionItem[];
  experiments: ValidationExperimentItem[];
  opportunityScore: number;
  evidenceConfidence: number;
  criticalClaimsCovered: number;
  costSummary: {
    minBuildMinorCents: number;
    maxBuildMinorCents: number;
    minWeeks: number;
    maxWeeks: number;
    minMonthlyOpMinorCents: number;
    maxMonthlyOpMinorCents: number;
  };
  evidenceLinks?: {
    normalizedSignalId: string;
    claimType: any;
    claimIdentifier: string;
    claimSnippet: string;
    relationshipType: any;
    supportStrength: any;
    explanation?: string | null;
    relevanceScore: number;
  }[];
  snapshotData?: any;
}

export function computeBlueprintInputHash(input: CreateRevisionInput): string {
  const canonicalObj = {
    oppId: input.opportunityId,
    reason: input.reasonForChange,
    segments: input.customerSegments.map((s) => ({
      name: s.segmentName,
      role: s.economicBuyerRole,
      motion: s.salesMotion,
    })),
    scenarios: input.scenarios.map((s) => ({
      type: s.scenarioType,
      price: s.monthlyPriceCents,
      cust: s.activeCustomers,
      fixed: s.monthlyFixedCostCents,
      var: s.variableCostPerCustomerCents,
      cac: s.customerAcquisitionCostCents,
    })),
    risks: input.risks.map((r) => ({ cat: r.category, sev: r.severity, desc: r.description })),
    assumptions: input.assumptions.map((a) => ({
      cat: a.category,
      imp: a.importanceScore,
      stat: a.status,
    })),
    oppScore: input.opportunityScore,
    confScore: input.evidenceConfidence,
  };

  const jsonStr = JSON.stringify(canonicalObj);
  return createHash("sha256").update(jsonStr).digest("hex");
}

export async function createOpportunityRevisionTransaction(
  prismaClient: any,
  input: CreateRevisionInput,
) {
  return await prismaClient.$transaction(async (tx: any) => {
    const lockKey =
      Math.abs(
        input.opportunityId
          .split("")
          .reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0),
      ) % 2147483647;

    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${lockKey})`);

    const opp = await tx.opportunity.findUniqueOrThrow({
      where: { id: input.opportunityId },
    });

    const lastRev = await tx.opportunityRevision.findFirst({
      where: { opportunityId: input.opportunityId },
      orderBy: { revisionNumber: "desc" },
    });
    const nextRevisionNumber = (lastRev?.revisionNumber ?? 0) + 1;

    const inputHash = computeBlueprintInputHash(input);
    const baseScenarioInput: FinancialScenarioInput = input.scenarios.find(
      (s) => s.scenarioType === "BASE",
    ) ||
      input.scenarios[0] || {
        scenarioType: "BASE",
        currency: "USD",
        activeCustomers: 0,
        monthlyPriceCents: 0,
        onboardingPriceCents: 0,
        variableCostPerCustomerCents: 0,
        monthlyFixedCostCents: 0,
        customerAcquisitionCostCents: 0,
        deliveryTimeWeeks: 0,
      };
    const baseScenarioMetrics = calculateScenarioMetrics(
      baseScenarioInput,
      input.costs,
      input.benefits,
    );

    const decision = evaluateDecisionRecommendation({
      opportunityScore: input.opportunityScore,
      evidenceConfidence: input.evidenceConfidence,
      publicationStatus: opp.publicationQualityStatus,
      criticalClaimsCoveredCount: input.criticalClaimsCovered,
      baseScenarioMetrics,
      risks: input.risks,
      assumptions: input.assumptions,
    });

    const revision = await tx.opportunityRevision.create({
      data: {
        opportunityId: opp.id,
        revisionNumber: nextRevisionNumber,
        snapshotData: input.snapshotData ?? {},
        reasonForChange: input.reasonForChange,
      },
    });

    const blueprint = await tx.opportunityBlueprint.create({
      data: {
        opportunityRevisionId: revision.id,
        schemaVersion: "1.0.0",
        generationStatus: "SYNTHESIZED",
        calculationVersion: "1.0.0",
        decisionRuleVersion: "1.0.0",
        inputHash,
        architectureSummary: input.architectureSummary,
        gtmNarrative: input.gtmNarrative ?? {},
        first20Plan: input.first20Plan ?? {},
        reachableMarket: input.reachableMarket ?? {},
      },
    });

    for (const seg of input.customerSegments) {
      await tx.blueprintCustomerSegment.create({
        data: {
          id: seg.id,
          blueprintId: blueprint.id,
          segmentName: seg.segmentName,
          industry: seg.industry,
          companySizeRange: seg.companySizeRange,
          geography: seg.geography || "North America / Global Remote",
          businessModel: seg.businessModel || "B2B SaaS",
          endUserRole: seg.endUserRole,
          economicBuyerRole: seg.economicBuyerRole,
          technicalApproverRole: seg.technicalApproverRole,
          procurementComplexity: seg.procurementComplexity,
          budgetCategory: seg.budgetCategory,
          spendingBehavior: seg.spendingBehavior,
          buyingTrigger: seg.buyingTrigger,
          primaryObjection: seg.primaryObjection,
          acquisitionChannels: seg.acquisitionChannels || [],
          salesCycleMinDays: seg.salesCycleMinDays || 14,
          salesCycleMaxDays: seg.salesCycleMaxDays || 60,
          salesMotion: seg.salesMotion || "FOUNDER_LED",
          confidenceScore: seg.confidenceScore || 70,
          provenanceType: seg.provenanceType || "MODEL_ESTIMATE",
        },
      });
    }

    for (const f of input.mvpFeatures) {
      await tx.blueprintMvpFeature.create({
        data: {
          id: f.id,
          blueprintId: blueprint.id,
          featureName: f.featureName,
          description: f.description,
          category: f.category,
          userJourneyStep: f.userJourneyStep,
          requiredIntegrations: f.requiredIntegrations || [],
          requiredData: f.requiredData || [],
          dependencies: f.dependencies || [],
          acceptanceCriteria: f.acceptanceCriteria || [],
          orderIndex: f.orderIndex || 0,
        },
      });
    }

    for (const c of input.competitors) {
      await tx.blueprintCompetitor.create({
        data: {
          id: c.id,
          blueprintId: blueprint.id,
          name: c.name,
          competitorType: c.competitorType || "DIRECT",
          knownPricing: c.knownPricing,
          strengths: c.strengths || [],
          recurringComplaints: c.recurringComplaints || [],
          differentiationHypothesis: c.differentiationHypothesis,
          switchingCosts: c.switchingCosts || "MEDIUM",
          provenanceType: c.provenanceType || "MODEL_ESTIMATE",
        },
      });
    }

    for (const sc of input.scenarios) {
      const metrics = calculateScenarioMetrics(sc, input.costs, input.benefits);
      await tx.financialScenario.create({
        data: {
          blueprintId: blueprint.id,
          scenarioType: sc.scenarioType,
          currency: sc.currency,
          activeCustomers: sc.activeCustomers,
          monthlyPriceCents: sc.monthlyPriceCents,
          onboardingPriceCents: sc.onboardingPriceCents,
          variableCostPerCustomerCents: sc.variableCostPerCustomerCents,
          monthlyFixedCostCents: sc.monthlyFixedCostCents,
          customerAcquisitionCostCents: sc.customerAcquisitionCostCents,
          deliveryTimeWeeks: sc.deliveryTimeWeeks,
          grossMarginPercent: metrics.grossMarginPercent.value,
          grossMarginStatus: metrics.grossMarginPercent.status,
          grossMarginReason: metrics.grossMarginPercent.reason,
          monthlyContributionMarginCents: metrics.monthlyContributionMarginCents.value,
          monthlyOperatingProfitCents: metrics.monthlyOperatingProfitCents.value,
          breakEvenCustomers: metrics.breakEvenCustomers.value,
          breakEvenStatus: metrics.breakEvenCustomers.status,
          breakEvenReason: metrics.breakEvenCustomers.reason,
          customerAnnualCostCents: metrics.customerAnnualCostCents.value,
          customerAnnualBenefitCents: metrics.customerAnnualBenefitCents.value,
          customerNetAnnualBenefitCents: metrics.customerNetAnnualBenefitCents.value,
          customerRoiPercent: metrics.customerRoiPercent.value,
          customerRoiStatus: metrics.customerRoiPercent.status,
          customerRoiReason: metrics.customerRoiPercent.reason,
          customerPaybackMonths: metrics.customerPaybackMonths.value,
          customerPaybackStatus: metrics.customerPaybackMonths.status,
          customerPaybackReason: metrics.customerPaybackMonths.reason,
          providerCacPaybackMonths: metrics.providerCacPaybackMonths.value,
          providerCacPaybackStatus: metrics.providerCacPaybackMonths.status,
          providerCacPaybackReason: metrics.providerCacPaybackMonths.reason,
          provenanceType: "MODEL_ESTIMATE",
          assumptions: sc.assumptions || [],
          inputHash,
        },
      });
    }

    for (const c of input.costs) {
      await tx.costLineItem.create({
        data: {
          id: c.id,
          blueprintId: blueprint.id,
          costType: c.costType,
          category: c.category,
          title: c.title,
          description: c.description,
          scenarioType: c.scenarioType || "BASE",
          amountMinorCents: c.amountMinorCents,
          currency: c.currency || "USD",
          estimateMethod: c.estimateMethod || "Benchmark rate",
          provenanceType: c.provenanceType || "MODEL_ESTIMATE",
          confidenceScore: c.confidenceScore || 70,
        },
      });
    }

    for (const b of input.benefits) {
      await tx.benefitDriver.create({
        data: {
          id: b.id,
          blueprintId: blueprint.id,
          category: b.category,
          title: b.title,
          affectedRole: b.affectedRole,
          unitQuantity: b.unitQuantity,
          unitValueCents: b.unitValueCents,
          frequencyPeriod: b.frequencyPeriod || "MONTHLY",
          annualValueCents: b.annualValueCents,
          calculationDescription: b.calculationDescription,
          provenanceType: b.provenanceType || "MODEL_ESTIMATE",
          confidenceScore: b.confidenceScore || 70,
        },
      });
    }

    for (const r of input.risks) {
      await tx.blueprintRisk.create({
        data: {
          id: r.id,
          blueprintId: blueprint.id,
          category: r.category,
          description: r.description,
          probabilityScore: r.probabilityScore,
          impactScore: r.impactScore,
          severity: r.severity,
          mitigationStrategy: r.mitigationStrategy,
          earlyWarningIndicator: r.earlyWarningIndicator,
          status: r.status || "IDENTIFIED",
          provenanceType: r.provenanceType || "MODEL_ESTIMATE",
        },
      });
    }

    for (const a of input.assumptions) {
      await tx.blueprintAssumption.create({
        data: {
          id: a.id,
          blueprintId: blueprint.id,
          statement: a.statement,
          category: a.category,
          importanceScore: a.importanceScore,
          uncertaintyScore: a.uncertaintyScore,
          testMethod: a.testMethod,
          successThreshold: a.successThreshold,
          failureThreshold: a.failureThreshold,
          status: a.status || "UNTESTED",
          provenanceType: a.provenanceType || "ASSUMPTION",
        },
      });
    }

    for (const e of input.experiments) {
      await tx.validationExperiment.create({
        data: {
          id: e.id,
          blueprintId: blueprint.id,
          hypothesis: e.hypothesis,
          experimentType: e.experimentType,
          targetParticipant: e.targetParticipant,
          sampleSize: e.sampleSize,
          estimatedCostCents: e.estimatedCostCents,
          estimatedDurationDays: e.estimatedDurationDays,
          acquisitionChannel: e.acquisitionChannel,
          procedureSummary: e.procedureSummary,
          successMetric: e.successMetric,
          successThreshold: e.successThreshold,
          failureThreshold: e.failureThreshold,
          killCriterion: e.killCriterion,
          nextActionOnSuccess: e.nextActionOnSuccess,
          nextActionOnFailure: e.nextActionOnFailure,
          status: e.status || "PLANNED",
          orderPriority: e.orderPriority || 0,
        },
      });
    }

    await tx.decisionEvaluation.create({
      data: {
        blueprintId: blueprint.id,
        recommendation: decision.recommendation,
        reasonCodes: decision.reasonCodes,
        blockingConditions: decision.blockingConditions,
        opportunityScoreUsed: input.opportunityScore,
        evidenceConfidenceUsed: input.evidenceConfidence,
        publicationStatusUsed: opp.publicationQualityStatus,
        economicsStatus: decision.economicsStatus,
        feasibilityStatus: decision.feasibilityStatus,
        criticalRiskIds: decision.criticalRiskIds,
        invalidatedAssumptionIds: decision.invalidatedAssumptionIds,
        decisionRuleVersion: "1.0.0",
        inputHash,
      },
    });

    // Derive riskiest assumption deterministically
    const unresolvedAssumptions = input.assumptions
      .filter((a) => a.status === "UNTESTED" || a.status === "TESTING")
      .sort((a, b) => {
        const riskScoreA = (a.importanceScore || 1) * (a.uncertaintyScore || 1);
        const riskScoreB = (b.importanceScore || 1) * (b.uncertaintyScore || 1);
        if (riskScoreB !== riskScoreA) return riskScoreB - riskScoreA;
        return (a.id || "").localeCompare(b.id || "");
      });
    const riskiestAssumptionStatement =
      unresolvedAssumptions[0]?.statement ?? input.assumptions[0]?.statement ?? null;

    await tx.opportunity.update({
      where: { id: opp.id },
      data: {
        currentRevisionId: revision.id,
        decisionRecommendation: decision.recommendation,
        decisionReasonCodes: decision.reasonCodes,
        economicBuyer: input.customerSegments[0]?.economicBuyerRole ?? opp.economicBuyer,
        estimatedMvpCostMinCents: input.costSummary.minBuildMinorCents,
        estimatedMvpCostMaxCents: input.costSummary.maxBuildMinorCents,
        estimatedTimeToMvpMinWeeks: input.costSummary.minWeeks,
        estimatedTimeToMvpMaxWeeks: input.costSummary.maxWeeks,
        estimatedMonthlyOpCostMinCents: input.costSummary.minMonthlyOpMinorCents,
        estimatedMonthlyOpCostMaxCents: input.costSummary.maxMonthlyOpMinorCents,
        riskiestAssumption: riskiestAssumptionStatement,
        cheapestExperiment: input.experiments[0]?.hypothesis,
      },
    });

    await tx.opportunityRadarJob.create({
      data: {
        opportunityRevisionId: revision.id,
        status: "PENDING",
      },
    });

    await tx.auditLog.create({
      data: {
        action: "OPPORTUNITY_REVISION_CREATED",
        entityType: "OPPORTUNITY_REVISION",
        entityId: revision.id,
        opportunityRevisionId: revision.id,
        newState: decision.recommendation,
        reason: input.reasonForChange,
        details: { revisionNumber: nextRevisionNumber, inputHash },
      },
    });

    return {
      revisionId: revision.id,
      blueprintId: blueprint.id,
      revisionNumber: nextRevisionNumber,
      decisionRecommendation: decision.recommendation,
    };
  });
}
