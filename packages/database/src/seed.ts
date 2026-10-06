import { prisma } from "./client.js";

export async function seedDatabase() {
  console.log("Seeding BuildWorth database with deterministic baseline fixtures...");

  // 1. Sources
  const sources = [
    {
      key: "hackernews",
      name: "Hacker News",
      description: "Firebase & Algolia APIs for tech discussions",
      adapterType: "HACKERNEWS_API",
      accessMethod: "API",
    },
    {
      key: "reddit",
      name: "Reddit Tech & Ops",
      description: "Targeted subreddits for developer and business operations",
      adapterType: "REDDIT_OAUTH",
      accessMethod: "OAUTH_API",
    },
    {
      key: "github",
      name: "GitHub Issues",
      description: "Public repository issues and discussions on tool friction",
      adapterType: "GITHUB_REST",
      accessMethod: "API",
    },
    {
      key: "producthunt",
      name: "Product Hunt",
      description: "Launch metadata, reviews, and missing feature comments",
      adapterType: "PRODUCTHUNT_GRAPHQL",
      accessMethod: "GRAPHQL",
    },
  ];

  for (const src of sources) {
    await prisma.source.upsert({
      where: { key: src.key },
      update: {},
      create: src,
    });
  }

  // 2. Kill Switches
  const switches = ["ALL", "AI_GENERATION", "INGESTION", "AUTO_PUBLISH"];
  for (const s of switches) {
    await prisma.killSwitch.upsert({
      where: { subsystem: s },
      update: {},
      create: { subsystem: s, isActive: false, reason: "Initial default state" },
    });
  }

  // 3. Baseline Verified Opportunity
  const canonicalOppSlug = "automated-soc2-evidence-collector";
  const existingOpp = await prisma.opportunity.findUnique({
    where: { slug: canonicalOppSlug },
  });

  if (!existingOpp) {
    const opp = await prisma.opportunity.create({
      data: {
        slug: canonicalOppSlug,
        title: "Automated SOC2 Git Evidence Collector for Vercel Monorepos",
        oneSentenceSummary:
          "Eliminates quarterly 40-hour screenshot capture sprints for DevOps teams by binding commit signatures to audit controls.",
        problemStatement:
          "DevOps and engineering leads spend 40+ hours per quarter manually collecting and validating screenshots for SOC2 compliance.",
        jobsToBeDone: [
          "Collect compliance screenshots and cryptographic logs automatically on every git merge",
          "Export structured audit-ready evidence packages for external auditors",
          "Alert security leads when unreviewed pull requests merge to production",
        ],
        proposedProduct:
          "GitHub Action + Vercel Webhook engine producing tamper-evident audit logs bound to commit SHAs.",
        narrowMvpScope: [
          "GitHub Action for PR approval signature verification",
          "Vercel deployment environment snapshot webhook",
          "Evidence dashboard with exportable PDF/ZIP audit bundles",
        ],
        targetCustomerSegments: ["Series A-C SaaS companies preparing for SOC2 Type II"],
        economicBuyer: "VP of Engineering or Head of Security",
        endUser: "Senior DevOps Engineer",
        buyingTrigger: "Upcoming annual SOC2 Type II audit deadline",
        existingWorkflow:
          "Manual screenshots of PR approvals and Vercel env configs stored in shared Google Drive folders.",
        painSeverity: "HIGH",
        painFrequency: "MONTHLY",
        status: "PUBLISHED",
        customerType: "B2B",
        industry: "DevOps & Compliance",
        publicationQualityStatus: "VERIFIED",
        isDemoFixture: false,
        estimatedMvpCostMinCents: 500000,
        estimatedMvpCostMaxCents: 1200000,
        estimatedTimeToMvpMinWeeks: 4,
        estimatedTimeToMvpMaxWeeks: 8,
        estimatedMonthlyOpCostMinCents: 20000,
        estimatedMonthlyOpCostMaxCents: 50000,
        currency: "USD",
        recommendedNextExperiment:
          "Pre-sell 5 annual pilot licenses to Series A CTOs at $199/mo with a 14-day refund guarantee.",
        majorAssumptions: [
          "Auditors accept cryptographic commit signatures as primary evidence",
          "DevOps teams can install GitHub Actions without enterprise security review",
        ],
        majorRisks: [
          "SOC2 auditor resistance to automated evidence formats",
          "Incumbent compliance platforms launching native git bindings",
        ],
      },
    });

    const scorecard = await prisma.scorecard.create({
      data: {
        opportunityId: opp.id,
        opportunityScore: 89,
        evidenceConfidenceScore: 82,
        demandScore: 88,
        feasibilityScore: 92,
        economicsScore: 85,
        competitionScore: 80,
        goMarketScore: 84,
        rubricVersion: "2.0.0",
        isHypothesisOnly: false,
      },
    });

    await prisma.scoreDimension.createMany({
      data: [
        {
          scorecardId: scorecard.id,
          dimensionKey: "PAIN_EVIDENCE",
          name: "Pain Evidence",
          score: 14,
          maxScore: 15,
          explanation: "Recurring documented friction across discussions.",
        },
        {
          scorecardId: scorecard.id,
          dimensionKey: "BUYER_DEMAND",
          name: "Buyer Demand & WTP",
          score: 13,
          maxScore: 15,
          explanation: "Target buyer has verified budget authority.",
        },
        {
          scorecardId: scorecard.id,
          dimensionKey: "TECH_FEASIBILITY",
          name: "Technical Feasibility",
          score: 14,
          maxScore: 15,
          explanation: "Standard TypeScript & REST API patterns.",
        },
        {
          scorecardId: scorecard.id,
          dimensionKey: "ECONOMICS",
          name: "Cost-Benefit Economics",
          score: 13,
          maxScore: 15,
          explanation: "Substantial positive ROI against manual labor costs.",
        },
      ],
    });
  }

  console.log("Database seeded successfully.");
}

if (process.argv[1] && process.argv[1].endsWith("seed.js")) {
  seedDatabase()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
