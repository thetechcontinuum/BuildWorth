import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@buildworth/database";
import { createOpportunityRevisionTransaction } from "@buildworth/opportunity-engine";
import {
  CustomerSegmentItem,
  MvpFeatureItem,
  CompetitorItem,
  CostLineItemData,
  BenefitDriverData,
  RiskItem,
  AssumptionItem,
  ValidationExperimentItem,
} from "@buildworth/shared";
import { logger } from "@buildworth/observability";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
};

function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a.trim());
  const bufB = Buffer.from(b.trim());
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function checkAuthorization(request: NextRequest): { authorized: boolean; reason?: string } {
  if (process.env.VERCEL_ENV === "production" || process.env.BUILDWORTH_ENV === "production") {
    return { authorized: false, reason: "PRODUCTION_REJECTED" };
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.trim() === "") {
    return { authorized: false, reason: "CRON_SECRET_UNCONFIGURED" };
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { authorized: false, reason: "MISSING_BEARER_TOKEN" };
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!timingSafeEqualStr(token, cronSecret)) {
    return { authorized: false, reason: "INVALID_SECRET" };
  }

  return { authorized: true };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = checkAuthorization(request);
  if (!auth.authorized) {
    if (auth.reason === "PRODUCTION_REJECTED") {
      return NextResponse.json(
        { error: "Forbidden in production environment" },
        { status: 403, headers: NO_CACHE_HEADERS },
      );
    }
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: NO_CACHE_HEADERS },
    );
  }

  try {
    logger.info("Generating draft opportunity hypotheses from KrASIA discovery signals...");

    // Find KrASIA normalized signals in staging database
    const krasiaSignals = await prisma.normalizedSignal.findMany({
      where: {
        rawSignal: {
          sourceUrl: {
            contains: "kr-asia.com",
          },
        },
      },
      include: {
        rawSignal: {
          include: { source: true },
        },
      },
    });

    const signalMap = new Map<string, (typeof krasiaSignals)[0]>();
    for (const s of krasiaSignals) {
      if (s.canonicalUrl) signalMap.set(s.canonicalUrl, s);
      if (s.rawSignal?.sourceUrl) signalMap.set(s.rawSignal.sourceUrl, s);
    }

    const draftsToCreate = [
      {
        slug: "ev-battery-carbon-passport-auditor",
        title: "Upstream EV Battery Carbon Traceability & EU Passport Auditor",
        oneSentenceSummary: "Automated Scope 3 carbon footprint verification and Digital Battery Passport readiness platform for European automotive battery component suppliers.",
        problemStatement: "Under EU Battery Regulation (EU 2023/1542), EV battery manufacturers and automotive suppliers must report verified lifecycle carbon footprints and prepare Digital Battery Passports. Mid-sized Tier-1/2 component suppliers face severe administrative overhead collecting, auditing, and cryptographically verifying raw material emissions data across fragmented Asian and global supply tiers.",
        jobsToBeDone: [
          "Aggregate Tier-2/3 cathode, anode, and mineral supplier carbon certificates.",
          "Calculate product-level battery carbon footprint according to EU Joint Research Centre (JRC) lifecycle rules.",
          "Generate exportable Digital Battery Passport data schemas for OEM audit portals."
        ],
        proposedProduct: "Cloud-based B2B ESG supply chain data validation engine with automated supplier portal, bill-of-materials carbon calculation, and EU 2023/1542 compliance reporting.",
        narrowMvpScope: [
          "BOM-level carbon footprint calculator for battery cathode and cell packaging.",
          "Supplier self-service intake portal for Scope 1/2 emissions and supplier audit certificates.",
          "EU Battery Passport JSON-LD/QR-code verification schema export."
        ],
        targetCustomerSegments: [
          "European battery component & pack manufacturers (e.g. Croatia/EU regional EV supply chain).",
          "Tier-1 EV tier suppliers and battery cell packagers."
        ],
        economicBuyer: "VP of Sustainability / Head of Supply Chain Compliance",
        endUser: "ESG Data Analyst / Supplier Quality Engineer",
        buyingTrigger: "Upcoming 2027 EU Battery Regulation mandatory carbon threshold audit deadlines.",
        existingWorkflow: "Manual Excel spreadsheets, ad-hoc supplier email questionnaires, and expensive static third-party consulting audits.",
        painSeverity: "HIGH" as const,
        painFrequency: "MONTHLY" as const,
        industry: "CleanTech & Supply Chain Compliance",
        customerType: "B2B" as const,
        originalMarket: "China / East Asia battery manufacturing (CATL supplier network).",
        sourceUrl: "https://kr-asia.com/catl-tightens-supplier-scrutiny-in-push-for-carbon-neutral-ev-batteries",
        observedFacts: "CATL tightens supplier scrutiny to achieve carbon neutrality across its upstream supply chain.",
        potentialEuAdaptation: "EU Battery Regulation (EU 2023/1542) mandates Digital Battery Passports by 2027. Croatian and European automotive suppliers (e.g., Rimac Technology) require automated data exchange for Asian raw material carbon validation without heavy enterprise consulting.",
        feasibility: "High technical feasibility via standard web APIs, Postgres, and standardized carbon calculation models.",
        competitors: ["Circulor", "Minviro", "Carbon Minds", "Carbmee", "Sphera"],
        missingValidation: "No verified willingness-to-pay commitment from Croatian/EU SME suppliers; unverified whether OEMs will demand specific proprietary enterprise platforms instead of independent SaaS.",
        economics: {
          minMvpCostCents: 1500000,
          maxMvpCostCents: 3500000,
          minMvpWeeks: 6,
          maxMvpWeeks: 12,
          minMonthlyOpCents: 40000,
          maxMonthlyOpCents: 120000,
        },
        recommendedNextExperiment: "Conduct 15 structured discovery interviews with supply chain and compliance managers at regional European EV/battery suppliers to evaluate current data exchange bottlenecks and willingness to test a pilot audit tool.",
      },
      {
        slug: "synthetic-tactile-robotics-simulation",
        title: "Synthetic Tactile Sensor Simulation Suite for Industrial Robotics",
        oneSentenceSummary: "Physics-informed synthetic tactile and force-torque sensor data generation suite for industrial robotic assembly and dexterous manipulation.",
        problemStatement: "Physical industrial robots lack general embodied AI foundation models due to the acute scarcity of high-fidelity physical tactile and force feedback training data. Robotics engineers spend weeks manually collecting physical sensor traces on physical assembly lines to tune manipulation and insertion tasks.",
        jobsToBeDone: [
          "Simulate high-resolution tactile array readings across variable surface textures.",
          "Generate synthetic force-torque telemetry for domain-randomized insertion and assembly scenarios.",
          "Export synthetic dataset pipelines directly to ROS2 and PyTorch training pipelines."
        ],
        proposedProduct: "Simulation plugin and synthetic data generation API that generates photorealistic and physics-accurate tactile contact maps for robot reinforcement learning and automated quality tuning.",
        narrowMvpScope: [
          "Physics simulation integration (MuJoCo / Isaac Sim compatible) for elastic tactile sensor deformations.",
          "Procedural surface defect and friction coefficient generator.",
          "ROS2 dataset exporter with synchronized multi-modal camera and tactile tensors."
        ],
        targetCustomerSegments: [
          "Industrial robotics systems integrators.",
          "Embodied AI and automated robotic assembly startups in Europe."
        ],
        economicBuyer: "Head of Robotics Engineering / VP of Automation R&D",
        endUser: "Robotics Software Engineer / Simulation Engineer",
        buyingTrigger: "Delays in physical assembly line deployment caused by edge cases in mechanical grasping and contact variance.",
        existingWorkflow: "Manual hardware test rigs, physical strain gauges, trial-and-error Python scripts.",
        painSeverity: "HIGH" as const,
        painFrequency: "DAILY" as const,
        industry: "Robotics & Industrial Automation",
        customerType: "B2B" as const,
        originalMarket: "East Asia / China industrial robotics development (Qianjue Robotics insights).",
        sourceUrl: "https://kr-asia.com/why-qianjues-founder-expects-no-chatgpt-moment-for-robotics",
        observedFacts: "Qianjue Robotics founder explains that general robotics cannot rely on LLM-style pretraining because tactile and physical interaction data is too scarce and hardware-dependent.",
        potentialEuAdaptation: "Central/Eastern European manufacturing integrators and Croatian precision engineering firms (e.g., automated metal machining, electronics assembly) can reduce physical robot commissioning time by training manipulation models in high-fidelity tactile simulations.",
        feasibility: "Medium-to-high technical complexity (requires physics simulation, CUDA/compute shaders, and domain randomization expertise).",
        competitors: ["NVIDIA Isaac Sim", "Physical Intelligence", "Synthesis AI", "Anyverse", "RoboHive"],
        missingValidation: "No verified customer demand or procurement intent from European automation houses; need confirmation whether engineers prefer off-the-shelf simulators over a specialized tactile tool.",
        economics: {
          minMvpCostCents: 2000000,
          maxMvpCostCents: 4500000,
          minMvpWeeks: 8,
          maxMvpWeeks: 14,
          minMonthlyOpCents: 60000,
          maxMonthlyOpCents: 200000,
        },
        recommendedNextExperiment: "Build an open-source demonstration benchmark comparing physical vs simulated tactile readings for 3 standard industrial connectors and measure developer signups/inquiries.",
      },
      {
        slug: "multimodal-factory-safety-dispatcher",
        title: "Multi-Camera Edge Spatial Safety & Workflow Audit Dispatcher",
        oneSentenceSummary: "Edge AI multi-camera spatio-temporal reasoning dispatcher for real-time industrial safety zone compliance and bottleneck auditing.",
        problemStatement: "Manufacturing and logistics facilities struggle to maintain 24/7 worker safety zone compliance (e.g. forklift-pedestrian separation, PPE compliance in hazardous zones) using existing CCTV spot checks or single-camera vision models that suffer from occlusion and blind spots.",
        jobsToBeDone: [
          "Synthesize multi-angle CCTV feeds into a unified 3D coordinate map of shop floor movements.",
          "Detect safety zone incursions and near-miss forklift interactions with sub-second latency.",
          "Generate automated weekly near-miss safety logs and compliance heatmaps for plant safety officers."
        ],
        proposedProduct: "On-premise edge computing appliance software connecting to standard RTSP camera streams, utilizing lightweight spatial vision models for real-time safety alerts and OSHA/EU safety reporting.",
        narrowMvpScope: [
          "RTSP video stream ingestion pipeline with 4-camera perspective alignment.",
          "Zone incursion and PPE detection model running on edge GPU (e.g. NVIDIA Jetson/workstation).",
          "Instant Slack/SMS alert webhook and daily PDF compliance audit report generator."
        ],
        targetCustomerSegments: [
          "European logistics centers, freight handling depots (e.g. Port of Rijeka, Zagreb distribution hubs).",
          "Industrial manufacturing plants and heavy machinery workshops."
        ],
        economicBuyer: "Plant Manager / Director of Health, Safety & Environment (HSE)",
        endUser: "Facility Safety Officer / Operations Supervisor",
        buyingTrigger: "Safety audit failure, near-miss workplace accident, or escalating workplace injury insurance premiums.",
        existingWorkflow: "Periodic manual safety audits, passive CCTV recording reviewed only after an incident occurs.",
        painSeverity: "HIGH" as const,
        painFrequency: "DAILY" as const,
        industry: "Industrial AI & Logistics Safety",
        customerType: "B2B" as const,
        originalMarket: "China / Pan-Asia computer vision deployment (SenseTime multimodal advances).",
        sourceUrl: "https://kr-asia.com/multimodal-ai-breakthrough-could-come-within-two-years-sensetime-scientist-says",
        observedFacts: "SenseTime research indicates multimodal spatial reasoning and multi-camera physical context understanding are maturing for industrial inspection and monitoring within 1-2 years.",
        potentialEuAdaptation: "Croatian transport/logistics corridors and EU industrial facilities face strict EU workplace safety standards and labor shortages. Edge-based spatial reasoning provides automated safety tracking without sending sensitive employee video to foreign cloud providers (satisfying GDPR).",
        feasibility: "Medium technical complexity (requires edge video decoding, YOLO/spatial object tracker, and on-premise deployment package).",
        competitors: ["Protex AI", "Invisible AI", "Intensif-Eye", "Landing AI", "Cognex"],
        missingValidation: "No verified willingness-to-pay from regional plant operators; unverified hardware installation constraints and local labor council / GDPR video surveillance approval requirements.",
        economics: {
          minMvpCostCents: 1800000,
          maxMvpCostCents: 4000000,
          minMvpWeeks: 6,
          maxMvpWeeks: 12,
          minMonthlyOpCents: 30000,
          maxMonthlyOpCents: 100000,
        },
        recommendedNextExperiment: "Partner with one local distribution warehouse to run a 2-week passive pilot with 2 RTSP cameras detecting forklift-pedestrian intersection clearance.",
      },
    ];

    const results: any[] = [];

    for (const draft of draftsToCreate) {
      const matchedSignal = signalMap.get(draft.sourceUrl);

      // Upsert Opportunity
      let opp = await prisma.opportunity.findUnique({
        where: { slug: draft.slug },
      });

      if (!opp) {
        opp = await prisma.opportunity.create({
          data: {
            slug: draft.slug,
            title: draft.title,
            oneSentenceSummary: draft.oneSentenceSummary,
            problemStatement: draft.problemStatement,
            jobsToBeDone: draft.jobsToBeDone,
            proposedProduct: draft.proposedProduct,
            narrowMvpScope: draft.narrowMvpScope,
            targetCustomerSegments: draft.targetCustomerSegments,
            economicBuyer: draft.economicBuyer,
            endUser: draft.endUser,
            buyingTrigger: draft.buyingTrigger,
            existingWorkflow: draft.existingWorkflow,
            painSeverity: draft.painSeverity,
            painFrequency: draft.painFrequency,
            status: "DRAFT",
            publicationQualityStatus: "HYPOTHESIS",
            customerType: draft.customerType,
            industry: draft.industry,
            isDemoFixture: false,
            estimatedMvpCostMinCents: draft.economics.minMvpCostCents,
            estimatedMvpCostMaxCents: draft.economics.maxMvpCostCents,
            estimatedTimeToMvpMinWeeks: draft.economics.minMvpWeeks,
            estimatedTimeToMvpMaxWeeks: draft.economics.maxMvpWeeks,
            estimatedMonthlyOpCostMinCents: draft.economics.minMonthlyOpCents,
            estimatedMonthlyOpCostMaxCents: draft.economics.maxMonthlyOpCents,
            recommendedNextExperiment: draft.recommendedNextExperiment,
            majorAssumptions: [
              `[HYPOTHESIS] Adaptation to EU/Croatia market: ${draft.potentialEuAdaptation}`,
              "No proven buyer demand or verified willingness to pay collected yet.",
            ],
            majorRisks: [
              "Unvalidated customer willingness to pay.",
              "Incumbent market friction and integration complexity.",
            ],
          },
        });
      }

      // Create Scorecard if missing
      const existingScorecard = await prisma.scorecard.findFirst({
        where: { opportunityId: opp.id },
      });

      if (!existingScorecard) {
        await prisma.scorecard.create({
          data: {
            opportunityId: opp.id,
            opportunityScore: 78,
            evidenceConfidenceScore: 65,
            demandScore: 60,
            feasibilityScore: 85,
            economicsScore: 80,
            competitionScore: 75,
            goMarketScore: 70,
            rubricVersion: "2.0.0",
            isHypothesisOnly: true,
          },
        });
      }

      // Build customer segments, features, competitors, costs for revision
      const customerSegments: CustomerSegmentItem[] = draft.targetCustomerSegments.map((name) => ({
        id: "seg-" + crypto.randomUUID(),
        segmentName: name,
        industry: draft.industry,
        companySizeRange: "10-250 employees",
        geography: "Croatia / European Union",
        businessModel: "B2B SaaS / On-Premise",
        economicBuyerRole: draft.economicBuyer,
        endUserRole: draft.endUser,
        procurementComplexity: "MEDIUM",
        budgetCategory: "OPERATIONAL_TOOLS",
        spendingBehavior: "INVOICE",
        buyingTrigger: draft.buyingTrigger,
        primaryObjection: "Budget and compliance validation",
        acquisitionChannels: ["DIRECT_OUTREACH", "INDUSTRY_CONFERENCES"],
        salesCycleMinDays: 30,
        salesCycleMaxDays: 90,
        salesMotion: "FOUNDER_LED",
        confidenceScore: 65,
        provenanceType: "MODEL_ESTIMATE",
        evidenceLinkIds: [],
      }));

      const mvpFeatures: MvpFeatureItem[] = draft.narrowMvpScope.map((name, idx) => ({
        id: "feat-" + crypto.randomUUID(),
        featureName: name,
        description: name,
        category: "MUST_HAVE",
        userJourneyStep: "ONBOARDING",
        requiredIntegrations: [],
        requiredData: [],
        dependencies: [],
        acceptanceCriteria: ["Meets core functional validation"],
        orderIndex: idx,
      }));

      const competitors: CompetitorItem[] = draft.competitors.map((name) => ({
        id: "comp-" + crypto.randomUUID(),
        name,
        competitorType: "DIRECT",
        differentiationHypothesis: "Tailored to European / regional compliance workflows with accessible integration.",
        switchingCosts: "MEDIUM",
        strengths: ["Existing brand presence"],
        recurringComplaints: ["High enterprise pricing and rigid deployment requirements"],
        provenanceType: "MODEL_ESTIMATE",
        evidenceLinkIds: [],
      }));

      const costs: CostLineItemData[] = [
        {
          id: "cost-" + crypto.randomUUID(),
          costType: "ONE_TIME_BUILD",
          category: "BACKEND_DEV",
          title: "MVP Engineering Build",
          scenarioType: "BASE",
          amountMinorCents: draft.economics.minMvpCostCents,
          currency: "USD",
          estimateMethod: "Engineering hours benchmark",
          provenanceType: "MODEL_ESTIMATE",
          evidenceLinkIds: [],
          assumptionIds: [],
          confidenceScore: 70,
        },
      ];

      const benefits: BenefitDriverData[] = [
        {
          id: "ben-" + crypto.randomUUID(),
          category: "LABOR_TIME_SAVED",
          title: "Operational Hours Saved",
          affectedRole: draft.endUser,
          unitQuantity: 20,
          unitValueCents: 6000,
          annualValueCents: 1440000,
          frequencyPeriod: "MONTHLY",
          calculationDescription: "Hours saved per month across operations team",
          provenanceType: "MODEL_ESTIMATE",
          evidenceLinkIds: [],
          assumptionIds: [],
          confidenceScore: 65,
        },
      ];

      const risks: RiskItem[] = [
        {
          id: "risk-" + crypto.randomUUID(),
          category: "MARKET",
          severity: "HIGH",
          description: "Prospective European buyers have not yet signed paid pilot letters of intent.",
          mitigationStrategy: draft.recommendedNextExperiment,
          evidenceLinkIds: [],
          probabilityScore: 4,
          impactScore: 4,
          status: "IDENTIFIED",
          provenanceType: "MODEL_ESTIMATE",
        },
      ];

      const assumptions: AssumptionItem[] = [
        {
          id: "assump-" + crypto.randomUUID(),
          statement: `[HYPOTHESIS] Croatia / EU market transfer: ${draft.potentialEuAdaptation}`,
          category: "PROBLEM",
          importanceScore: 5,
          uncertaintyScore: 4,
          testMethod: "Customer discovery interviews and prototype demo",
          successThreshold: "Validated pain in >= 3 interviews",
          failureThreshold: "No pain found in >= 10 interviews",
          status: "UNTESTED",
          evidenceLinkIds: [],
          provenanceType: "MODEL_ESTIMATE",
        },
      ];

      const experiments: ValidationExperimentItem[] = [
        {
          id: "exp-" + crypto.randomUUID(),
          hypothesis: "Target operators face friction in current workflows and will commit to a free structured pilot.",
          experimentType: "CUSTOMER_INTERVIEW",
          targetParticipant: draft.economicBuyer,
          sampleSize: 15,
          estimatedCostCents: 0,
          estimatedDurationDays: 14,
          acquisitionChannel: "DIRECT_OUTREACH",
          procedureSummary: "Conduct structured problem discovery interviews.",
          successMetric: "Pilot signup rate (> 20% of qualified outreach)",
          successThreshold: "3 verbal pilot commitments from 15 target accounts",
          failureThreshold: "0 interested accounts after 20 outreach attempts",
          killCriterion: "0 interested accounts after 20 outreach attempts",
          nextActionOnSuccess: "Build MVP",
          nextActionOnFailure: "Pivot value proposition",
          status: "PLANNED",
          orderPriority: 1,
          evidenceGeneratedIds: [],
        },
      ];

      const rev = await createOpportunityRevisionTransaction(prisma, {
        opportunityId: opp.id,
        reasonForChange: "Generated from KrASIA Asian discovery signal as DRAFT / HYPOTHESIS",
        architectureSummary: draft.proposedProduct,
        customerSegments,
        mvpFeatures,
        competitors,
        scenarios: [
          {
            scenarioType: "BASE",
            currency: "USD",
            activeCustomers: 20,
            monthlyPriceCents: 29900,
            onboardingPriceCents: 0,
            variableCostPerCustomerCents: 1000,
            monthlyFixedCostCents: 50000,
            customerAcquisitionCostCents: 40000,
            deliveryTimeWeeks: draft.economics.minMvpWeeks,
            assumptions: ["B2B sales cycle 30-90 days"],
            evidenceIds: [],
          },
        ],
        costs,
        benefits,
        risks,
        assumptions,
        experiments,
        opportunityScore: 78,
        evidenceConfidence: 65,
        criticalClaimsCovered: matchedSignal ? 1 : 0,
        costSummary: {
          minBuildMinorCents: draft.economics.minMvpCostCents,
          maxBuildMinorCents: draft.economics.maxMvpCostCents,
          minWeeks: draft.economics.minMvpWeeks,
          maxWeeks: draft.economics.maxMvpWeeks,
          minMonthlyOpMinorCents: draft.economics.minMonthlyOpCents,
          maxMonthlyOpMinorCents: draft.economics.maxMonthlyOpCents,
        },
      });

      // Link NormalizedSignal if available
      if (matchedSignal) {
        const existingLink = await prisma.evidenceLink.findFirst({
          where: {
            opportunityId: opp.id,
            normalizedSignalId: matchedSignal.id,
          },
        });

        if (!existingLink) {
          await prisma.evidenceLink.create({
            data: {
              opportunityId: opp.id,
              opportunityRevisionId: rev.revisionId,
              normalizedSignalId: matchedSignal.id,
              claimType: "MARKET_ATTRACTIVENESS",
              claimIdentifier: `claim-discovery-${opp.id}`,
              claimSnippet: matchedSignal.sanitizedExcerpt || draft.observedFacts,
              relationshipType: "SUPPORTS",
              supportStrength: "MODERATE",
              explanation: `Discovery signal from KrASIA: ${draft.sourceUrl}`,
              relevanceScore: 0.85,
            },
          });
        }
      }

      results.push({
        id: opp.id,
        slug: opp.slug,
        title: opp.title,
        status: opp.status,
        publicationQualityStatus: opp.publicationQualityStatus,
        sourceUrl: draft.sourceUrl,
        originalMarket: draft.originalMarket,
        potentialEuAdaptation: draft.potentialEuAdaptation,
        inspectUrl: `/opportunities/${opp.slug}`,
      });
    }

    return NextResponse.json({
      success: true,
      draftsCreated: results.length,
      drafts: results,
      nonViableArticles: [
        {
          url: "https://kr-asia.com/huawei-brings-near-packaged-optics-to-ai-with-atlas-960e-superpod",
          title: "Huawei brings near-packaged optics to AI with Atlas 960E SuperPoD",
          reason: "Semiconductor packaging & optical hardware compute infrastructure requiring massive capital expenditure; not viable as a software startup application.",
        },
        {
          url: "https://kr-asia.com/seres-takes-the-lead-at-aito-as-huawei-reshapes-its-role",
          title: "Seres takes the lead at AITO as Huawei reshapes its role",
          reason: "Corporate OEM joint venture governance & brand asset transfer news; does not present a standalone software product gap.",
        },
        {
          url: "https://kr-asia.com/the-uptake-good-enough-for-what",
          title: "The Uptake: Good enough for what?",
          reason: "General editorial opinion piece discussing enterprise AI adoption skepticism; provides market sentiment rather than a specific repeatable customer problem space.",
        },
      ],
    }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    logger.error("Failed to generate drafts from discovery signals", error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500, headers: NO_CACHE_HEADERS },
    );
  }
}
