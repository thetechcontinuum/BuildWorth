import { describe, it, expect, beforeEach } from "vitest";
import {
  isSingleRepoTicket,
  isProductAnnouncement,
  extractAuthorOrRepoIdentifier,
  isAuthorSelfClaim,
  isSyndicatedCopy,
  evaluateCorroboratingEvidence,
  evaluateCandidateQualification,
  searchIndependentCorroboration,
  saveOrUpdateOpportunityCandidateWithRevisionAndLinks,
  buildAndPersistOpportunityBrief,
} from "../src/index.js";

function createMockPrisma() {
  const store = {
    opportunities: [] as any[],
    scorecards: [] as any[],
    revisions: [] as any[],
    blueprints: [] as any[],
    evidenceLinks: [] as any[],
    rawSignals: [] as any[],
    normalizedSignals: [] as any[],
    sources: [
      { id: "src-gh", key: "github", name: "GitHub", isEnabled: true, permittedExcerptLength: 280, sourceFamily: "DEVELOPER_ECOSYSTEM" },
      { id: "src-hn", key: "hackernews", name: "Hacker News", isEnabled: true, permittedExcerptLength: 280, sourceFamily: "COMMUNITY" },
      { id: "src-so", key: "stackexchange", name: "Stack Overflow", isEnabled: true, permittedExcerptLength: 280, sourceFamily: "COMMUNITY" },
    ] as any[],
  };

  const prisma: any = {
    _store: store,
    $transaction: async (fn: any) => fn(prisma),
    $executeRawUnsafe: async () => 0,
    opportunity: {
      findUnique: async ({ where }: any) => {
        if (where.id) return store.opportunities.find((o) => o.id === where.id) || null;
        if (where.slug) return store.opportunities.find((o) => o.slug === where.slug) || null;
        return null;
      },
      findUniqueOrThrow: async ({ where }: any) => {
        let opp = null;
        if (where.id) opp = store.opportunities.find((o) => o.id === where.id);
        else if (where.slug) opp = store.opportunities.find((o) => o.slug === where.slug);
        if (!opp) throw new Error("Opportunity not found");
        return opp;
      },
      findFirst: async ({ where }: any) => {
        return store.opportunities.find((o) => {
          if (where.slug && o.slug !== where.slug) return false;
          return true;
        }) || null;
      },
      findMany: async ({ where, include }: any = {}) => {
        return store.opportunities.filter((o) => {
          if (where?.slug?.startsWith && !o.slug.startsWith(where.slug.startsWith)) return false;
          if (where?.isDemoFixture !== undefined && o.isDemoFixture !== where.isDemoFixture) return false;
          return true;
        }).map((o) => {
          const res = { ...o };
          if (include?.evidenceLinks) {
            res.evidenceLinks = store.evidenceLinks.filter((el) => el.opportunityId === o.id).map((el) => {
              const elCopy = { ...el };
              if (include.evidenceLinks.include?.normalizedSignal) {
                const ns = store.normalizedSignals.find((n) => n.id === el.normalizedSignalId);
                elCopy.normalizedSignal = ns ? {
                  ...ns,
                  rawSignal: store.rawSignals.find((r) => r.id === ns.rawSignalId),
                } : null;
              }
              return elCopy;
            });
          }
          if (include?.scorecards) {
            res.scorecards = store.scorecards.filter((sc) => sc.opportunityId === o.id);
          }
          return res;
        });
      },
      create: async ({ data }: any) => {
        const record = { id: "opp-" + Math.random().toString(36).slice(2, 9), ...data, createdAt: new Date() };
        store.opportunities.push(record);
        return record;
      },
      update: async ({ where, data }: any) => {
        const item = store.opportunities.find((o) => o.id === where.id || o.slug === where.slug);
        if (!item) throw new Error("Opportunity not found");
        Object.assign(item, data, { updatedAt: new Date() });
        return item;
      },
      delete: async ({ where }: any) => {
        const idx = store.opportunities.findIndex((o) => o.id === where.id);
        if (idx >= 0) store.opportunities.splice(idx, 1);
        return { count: 1 };
      },
    },
    scorecard: {
      findFirst: async ({ where }: any) => {
        return store.scorecards.find((s) => s.opportunityId === where.opportunityId) || null;
      },
      create: async ({ data }: any) => {
        const record = { id: "sc-" + Math.random().toString(36).slice(2, 9), ...data, createdAt: new Date() };
        store.scorecards.push(record);
        return record;
      },
      update: async ({ where, data }: any) => {
        const item = store.scorecards.find((s) => s.id === where.id);
        if (item) Object.assign(item, data);
        return item;
      },
    },
    opportunityRevision: {
      findFirst: async ({ where, orderBy }: any = {}) => {
        let revs = store.revisions;
        if (where?.opportunityId) revs = revs.filter((r) => r.opportunityId === where.opportunityId);
        if (orderBy?.revisionNumber === "desc") {
          revs = [...revs].sort((a, b) => (b.revisionNumber || 1) - (a.revisionNumber || 1));
        }
        return revs[0] || null;
      },
      create: async ({ data }: any) => {
        const nextRevNum = store.revisions.filter((r) => r.opportunityId === data.opportunityId).length + 1;
        const rev = { id: "rev-" + Math.random().toString(36).slice(2, 9), ...data, revisionNumber: nextRevNum, createdAt: new Date() };
        store.revisions.push(rev);
        return rev;
      },
      findMany: async () => store.revisions,
      deleteMany: async () => ({ count: store.revisions.length }),
    },
    opportunityBlueprint: {
      create: async ({ data }: any) => {
        const bp = { id: "bp-" + Math.random().toString(36).slice(2, 9), ...data };
        store.blueprints.push(bp);
        return bp;
      },
      findMany: async () => store.blueprints,
      deleteMany: async () => ({ count: store.blueprints.length }),
    },
    blueprintCustomerSegment: {
      create: async ({ data }: any) => data,
      deleteMany: async () => ({ count: 0 }),
    },
    blueprintMvpFeature: {
      create: async ({ data }: any) => data,
      deleteMany: async () => ({ count: 0 }),
    },
    blueprintCompetitor: {
      create: async ({ data }: any) => data,
      deleteMany: async () => ({ count: 0 }),
    },
    financialScenario: {
      create: async ({ data }: any) => data,
      deleteMany: async () => ({ count: 0 }),
    },
    costLineItem: {
      create: async ({ data }: any) => data,
      deleteMany: async () => ({ count: 0 }),
    },
    benefitDriver: {
      create: async ({ data }: any) => data,
      deleteMany: async () => ({ count: 0 }),
    },
    blueprintRisk: {
      create: async ({ data }: any) => data,
      deleteMany: async () => ({ count: 0 }),
    },
    blueprintAssumption: {
      create: async ({ data }: any) => data,
      deleteMany: async () => ({ count: 0 }),
    },
    validationExperiment: {
      create: async ({ data }: any) => data,
      deleteMany: async () => ({ count: 0 }),
    },
    decisionEvaluation: {
      create: async ({ data }: any) => data,
      deleteMany: async () => ({ count: 0 }),
    },
    opportunityRadarJob: {
      create: async ({ data }: any) => ({ id: "radar-1", ...data }),
      deleteMany: async () => ({ count: 0 }),
    },
    auditLog: {
      create: async ({ data }: any) => ({ id: "audit-1", ...data }),
      deleteMany: async () => ({ count: 0 }),
    },
    evidenceLink: {
      findFirst: async ({ where }: any) => {
        return store.evidenceLinks.find((el) => {
          if (where.opportunityId && el.opportunityId !== where.opportunityId) return false;
          if (where.normalizedSignalId && el.normalizedSignalId !== where.normalizedSignalId) return false;
          if (where.normalizedSignalId?.in && !where.normalizedSignalId.in.includes(el.normalizedSignalId)) return false;
          return true;
        }) || null;
      },
      findMany: async ({ where }: any = {}) => {
        return store.evidenceLinks.filter((el) => {
          if (where.opportunityId && el.opportunityId !== where.opportunityId) return false;
          return true;
        });
      },
      create: async ({ data }: any) => {
        const link = { id: "link-" + Math.random().toString(36).slice(2, 9), ...data, createdAt: new Date() };
        store.evidenceLinks.push(link);
        return link;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const el of store.evidenceLinks) {
          if (where.opportunityId && el.opportunityId === where.opportunityId) {
            Object.assign(el, data);
            count++;
          }
        }
        return { count };
      },
      deleteMany: async ({ where }: any = {}) => {
        let count = 0;
        store.evidenceLinks = store.evidenceLinks.filter((el) => {
          if (where?.id?.in && where.id.in.includes(el.id)) {
            count++;
            return false;
          }
          if (where?.opportunityId && el.opportunityId === where.opportunityId) {
            count++;
            return false;
          }
          return true;
        });
        return { count };
      },
    },
    source: {
      findFirst: async ({ where }: any) => {
        return store.sources.find((s) => s.key === where?.key) || null;
      },
    },
    rawSignal: {
      findUnique: async ({ where }: any) => {
        if (where.contentHash) return store.rawSignals.find((r) => r.contentHash === where.contentHash) || null;
        return null;
      },
      create: async ({ data }: any) => {
        const record = { id: "raw-" + Math.random().toString(36).slice(2, 9), ...data, createdAt: new Date() };
        store.rawSignals.push(record);
        return record;
      },
    },
    normalizedSignal: {
      findFirst: async ({ where }: any) => {
        if (where.rawSignalId) return store.normalizedSignals.find((n) => n.rawSignalId === where.rawSignalId) || null;
        return null;
      },
      create: async ({ data }: any) => {
        const record = { id: "ns-" + Math.random().toString(36).slice(2, 9), ...data, createdAt: new Date() };
        store.normalizedSignals.push(record);
        return record;
      },
    },

    opportunityFounderRequirements: { deleteMany: async () => ({ count: 0 }) },
    founderFitEvaluation: { deleteMany: async () => ({ count: 0 }) },
    savedOpportunity: { deleteMany: async () => ({ count: 0 }) },
    opportunityChangeEvent: { deleteMany: async () => ({ count: 0 }) },
    scoreDimension: { deleteMany: async () => ({ count: 0 }) },
  };

  return prisma;
}

describe("Corroboration Stage & Qualification Suite", () => {
  describe("Single-Repository Request Detection", () => {
    it("detects GitHub issue and pull request URLs as single-repository tickets", () => {
      expect(isSingleRepoTicket("https://github.com/eduvault/eduvault/issues/104", "Feature request for webdav backup")).toBe(true);
      expect(isSingleRepoTicket("https://github.com/acme-org/agent-runner/pull/42", "Fix agent harness timeout")).toBe(true);
      expect(isSingleRepoTicket(undefined, "workflow-gap in agents/pr-fixer.md requires manual intervention")).toBe(true);
      expect(isSingleRepoTicket(undefined, "harness-feedback loop fails")).toBe(true);
    });

    it("does not flag general tech discussions or multi-platform issues as single repo tickets", () => {
      expect(isSingleRepoTicket("https://news.ycombinator.com/item?id=40001234", "Snowflake cost alerts drift across multi-cloud setups")).toBe(false);
      expect(isSingleRepoTicket("https://stackoverflow.com/questions/59102931", "Terraform state locks during concurrent CI pipelines")).toBe(false);
    });
  });

  describe("Product Announcement Detection", () => {
    it("identifies Show HN, Launch HN, and maker launch notices as product announcements", () => {
      expect(isProductAnnouncement("Show HN: Coding agents recorder", "I built a tool to record transcripts")).toBe(true);
      expect(isProductAnnouncement("Launch HN: AgentTrace", "We built an observability platform")).toBe(true);
      expect(isProductAnnouncement("Introducing DevRecorder v1.0", "An independent execution recorder for coding agents")).toBe(true);
      expect(isProductAnnouncement("An independent execution recorder for coding agents", "I gave access to my coding agent to do work on my repos so I manually checked each transcript")).toBe(true);
      expect(isProductAnnouncement("Title", "Content", "https://www.producthunt.com/posts/agent-recorder")).toBe(true);
    });

    it("does not flag customer pain or practitioner complaint posts as announcements", () => {
      expect(isProductAnnouncement("Debugging flaky CI pipelines in Kubernetes", "We spend 5 hours a week manually re-running timed out jobs")).toBe(false);
      expect(isProductAnnouncement("Any alternatives to Snowflake native monitoring?", "The native alerts fail to notify us before budget exceeds 200%")).toBe(false);
    });
  });

  describe("Corroborating Evidence Evaluation", () => {
    it("rejects author self-claims from the same repo or author fingerprint", () => {
      const primary = {
        url: "https://github.com/eduvault/eduvault/issues/104",
        authorFingerprint: "author-eduvault-dev",
        title: "EduVault backup feature",
      };
      const candidateSameAuthor = {
        url: "https://news.ycombinator.com/item?id=9999",
        authorFingerprint: "author-eduvault-dev",
        title: "I also need this backup feature",
        text: "I am working on EduVault and need this",
      };

      const result = evaluateCorroboratingEvidence(primary, candidateSameAuthor);
      expect(result.isIndependent).toBe(false);
      expect(result.relationshipType).toBe("IRRELEVANT");
      expect(result.rejectReason).toBe("AUTHOR_CLAIM");
    });

    it("rejects syndicated duplicate re-publications", () => {
      const primary = {
        url: "https://techblog.com/post-1",
        title: "Kafka offset reset causes data loss in stream processing",
        text: "When consumer groups rebalance during partition reassignment, committed offsets are silently reset causing duplicate message delivery across microservices.",
      };
      const candidateSyndicated = {
        url: "https://techblog.com/post-1",
        title: "Kafka offset reset causes data loss in stream processing",
        text: "When consumer groups rebalance during partition reassignment, committed offsets are silently reset causing duplicate message delivery across microservices.",
      };

      const result = evaluateCorroboratingEvidence(primary, candidateSyndicated);
      expect(result.isIndependent).toBe(false);
      expect(result.rejectReason).toBe("SYNDICATED_COPY");
    });

    it("rejects superficial keyword overlap when underlying problem mechanics differ", () => {
      const primary = {
        url: "https://github.com/orgA/repo/issues/12",
        title: "Docker container networking fails after DNS timeout in alpine",
        text: "Alpine musl libc resolver drops UDP packets when search domains exceed 3 entries.",
      };
      const candidateKeywordOverlap = {
        url: "https://stackoverflow.com/questions/11223344",
        title: "How to install Docker on Alpine Linux",
        text: "Here is a tutorial explaining how to install docker and apk packages on alpine.",
      };

      const result = evaluateCorroboratingEvidence(primary, candidateKeywordOverlap);
      expect(result.isIndependent).toBe(false);
      expect(result.relationshipType).toBe("IRRELEVANT");
    });

    it("classifies independent disconfirming/contradicting evidence as CONTRADICTS", () => {
      const primary = {
        url: "https://github.com/orgA/repo/issues/12",
        title: "Postgres connection pool exhaustion under spike traffic",
        text: "Pool exhaustion causes 504 errors on database queries during traffic spikes.",
      };
      const candidateDisconfirmation = {
        url: "https://stackoverflow.com/questions/99887766",
        title: "Postgres connection pool exhaustion under spike traffic",
        text: "This is not a bug and expected behavior due to user misconfiguration. Native feature exists in Postgres 16 with built-in connection limits.",
      };

      const result = evaluateCorroboratingEvidence(primary, candidateDisconfirmation);
      expect(result.isIndependent).toBe(true);
      expect(result.relationshipType).toBe("CONTRADICTS");
      expect(result.explanation).toContain("expected behavior");
    });

    it("classifies genuine independent practitioner corroboration as SUPPORTS", () => {
      const primary = {
        url: "https://github.com/orgA/data-tools/issues/50",
        authorFingerprint: "user-alpha",
        title: "Snowflake resource monitor alerts trigger hours after credit exhaustion",
        text: "Our warehouse exceeded monthly credit quota by 300% before the email notification arrived.",
        sourceKey: "github",
      };
      const candidateIndependent = {
        url: "https://stackoverflow.com/questions/77889900/snowflake-warehouse-cost-drift",
        authorFingerprint: "user-beta",
        title: "Snowflake resource monitor alerts lag behind actual compute consumption",
        text: "We have recurring monthly billing surprises because warehouse credit alerts have a 4-hour delay.",
        sourceKey: "stackexchange",
      };

      const result = evaluateCorroboratingEvidence(primary, candidateIndependent);
      expect(result.isIndependent).toBe(true);
      expect(result.relationshipType).toBe("SUPPORTS");
    });
  });

  describe("Candidate Qualification Rules", () => {
    it("demotes an uncorroborated single-repository ticket to DRAFT and EVIDENCE_PENDING", () => {
      const singleRepoSignal = {
        normalizedSignal: {
          id: "ns-single",
          canonicalUrl: "https://github.com/eduvault/eduvault/issues/104",
          sourceTitle: "EduVault webdav backup feature request",
          sanitizedExcerpt: "Please add webdav support to EduVault so we can self-host backups.",
        },
        rawSignal: {
          sourceUrl: "https://github.com/eduvault/eduvault/issues/104",
          authorFingerprint: "eduvault-user",
        },
        source: { key: "github", name: "GitHub" },
      };

      const qual = evaluateCandidateQualification(
        {
          title: "EduVault Self-Hosted Backup Sync",
          problemStatement: "Feature request in EduVault repository for webdav backups",
          primaryUrl: "https://github.com/eduvault/eduvault/issues/104",
          primarySourceKey: "github",
        },
        [singleRepoSignal],
        [],
        { status: "HYPOTHESIS", isEligibleForVerified: false },
        70,
      );

      expect(qual.isEligibleForOpportunity).toBe(false);
      expect(qual.finalStatus).toBe("DRAFT");
      expect(qual.pubQualityStatus).toBe("EVIDENCE_PENDING");
      expect(qual.isSingleRepo).toBe(true);
      expect(qual.qualificationReason).toContain("Single-repository request requires independent multi-organization corroboration");
    });

    it("demotes an uncorroborated product announcement to DRAFT and EVIDENCE_PENDING", () => {
      const announcementSignal = {
        normalizedSignal: {
          id: "ns-announcement",
          canonicalUrl: "https://news.ycombinator.com/item?id=41002000",
          sourceTitle: "Show HN: Coding agents recorder",
          sanitizedExcerpt: "I built an independent execution recorder for coding agents to inspect transcripts.",
        },
        rawSignal: {
          sourceUrl: "https://news.ycombinator.com/item?id=41002000",
          authorFingerprint: "maker-hn-user",
        },
        source: { key: "hackernews", name: "Hacker News" },
      };

      const qual = evaluateCandidateQualification(
        {
          title: "Show HN: Coding agents recorder",
          problemStatement: "An independent execution recorder for coding agents",
          primaryUrl: "https://news.ycombinator.com/item?id=41002000",
          primarySourceKey: "hackernews",
        },
        [announcementSignal],
        [],
        { status: "HYPOTHESIS", isEligibleForVerified: false },
        65,
      );

      expect(qual.isEligibleForOpportunity).toBe(false);
      expect(qual.finalStatus).toBe("DRAFT");
      expect(qual.pubQualityStatus).toBe("EVIDENCE_PENDING");
      expect(qual.isAnnouncement).toBe(true);
      expect(qual.qualificationReason).toContain("Product announcement establishes existing alternative, but independent customer pain and demand require separate practitioner evidence");
    });

    it("demotes an uncorroborated product announcement even if opportunity title is formatted without 'Show HN'", () => {
      const announcementSignal = {
        normalizedSignal: {
          id: "ns-announcement-reformatted",
          canonicalUrl: "https://news.ycombinator.com/item?id=41002000",
          sourceTitle: "Show HN: An independent execution recorder for coding agents",
          sanitizedExcerpt: "Show HN: An independent execution recorder for coding agents — A couple of months ago, I gave access to my coding agent to do work on my repos so I manually checked each transcript.",
        },
        rawSignal: {
          sourceUrl: "https://news.ycombinator.com/item?id=41002000",
          title: "Show HN: An independent execution recorder for coding agents",
          rawContent: "Show HN: An independent execution recorder for coding agents — A couple of months ago, I gave access to my coding agent to do work on my repos...",
          authorFingerprint: "altrace-maker",
        },
        source: { key: "hackernews", name: "Hacker News" },
      };

      const qual = evaluateCandidateQualification(
        {
          title: "Coding agents hallucinate actions, requiring manual verifica",
          problemStatement: "Developers using autonomous coding agents experience unannounced or hallucinated actions requiring manual transcript review",
          primaryUrl: "https://github.com/altrace-dev-role/rashomon",
          primarySourceKey: "github",
        },
        [announcementSignal],
        [],
        { status: "HYPOTHESIS", isEligibleForVerified: false },
        68,
      );

      expect(qual.isEligibleForOpportunity).toBe(false);
      expect(qual.finalStatus).toBe("DRAFT");
      expect(qual.pubQualityStatus).toBe("EVIDENCE_PENDING");
      expect(qual.isAnnouncement).toBe(true);
      expect(qual.qualificationReason).toContain("Product announcement establishes existing alternative");
    });

    it("demotes an uncorroborated single-repository ticket even if opportunity title is reformatted", () => {
      const singleRepoSignal = {
        normalizedSignal: {
          id: "ns-eduvault-reformatted",
          canonicalUrl: "https://github.com/eduvault/eduvault/issues/104",
          sourceTitle: "EduVault backup feature request",
          sanitizedExcerpt: "Please add webdav support to EduVault so we can self-host backups.",
        },
        rawSignal: {
          sourceUrl: "https://github.com/eduvault/eduvault/issues/104",
          title: "Feature request: webdav backup sync",
          authorFingerprint: "eduvault-user",
        },
        source: { key: "github", name: "GitHub" },
      };

      const qual = evaluateCandidateQualification(
        {
          title: "Educational institution data sync friction",
          problemStatement: "Self-hosted educational vaults struggle with webdav sync",
          primaryUrl: "https://github.com/eduvault/eduvault/issues/104",
          primarySourceKey: "github",
        },
        [singleRepoSignal],
        [],
        { status: "HYPOTHESIS", isEligibleForVerified: false },
        60,
      );

      expect(qual.isEligibleForOpportunity).toBe(false);
      expect(qual.finalStatus).toBe("DRAFT");
      expect(qual.pubQualityStatus).toBe("EVIDENCE_PENDING");
      expect(qual.isSingleRepo).toBe(true);
      expect(qual.qualificationReason).toContain("Single-repository request requires independent multi-organization corroboration");
    });

    it("rejects an infeasible candidate and records clear explanation", () => {
      const appleRecoverySignal = {
        normalizedSignal: {
          id: "ns-apple",
          canonicalUrl: "https://discussions.apple.com/thread/123",
          sourceTitle: "Apple ID locked account recovery takes weeks",
          sanitizedExcerpt: "Users locked out of Apple ID wait weeks for automated recovery.",
        },
        rawSignal: {
          sourceUrl: "https://discussions.apple.com/thread/123",
        },
        source: { key: "community", name: "Apple Discussions" },
      };

      const qual = evaluateCandidateQualification(
        {
          title: "Apple ID Account Recovery Automation",
          problemStatement: "Apple ID locked accounts force users into week-long automated recovery",
          primaryUrl: "https://discussions.apple.com/thread/123",
        },
        [appleRecoverySignal],
        [],
        { status: "HYPOTHESIS" },
        70,
      );

      expect(qual.isEligibleForOpportunity).toBe(false);
      expect(qual.finalStatus).toBe("REJECTED");
      expect(qual.pubQualityStatus).toBe("EVIDENCE_PENDING");
      expect(qual.qualificationReason).toContain("Infeasible for an independent product");
    });

    it("rejects candidate when independent evidence disconfirms/contradicts the problem", () => {
      const primarySignal = {
        normalizedSignal: { id: "ns-1", canonicalUrl: "https://github.com/org/repo/issues/1" },
        rawSignal: { sourceUrl: "https://github.com/org/repo/issues/1" },
        source: { key: "github" },
      };
      const contradictingSignal = {
        normalizedSignal: { id: "ns-c1" },
        rawSignal: { sourceUrl: "https://stackoverflow.com/questions/2" },
        source: { key: "stackexchange" },
        explanation: "issue resolved natively by standard platform config",
      };

      const qual = evaluateCandidateQualification(
        { title: "Reported Memory Leak", problemStatement: "NodeJS process memory spike" },
        [primarySignal],
        [contradictingSignal],
        { status: "HYPOTHESIS" },
        65,
      );

      expect(qual.finalStatus).toBe("REJECTED");
      expect(qual.isContradicted).toBe(true);
      expect(qual.qualificationReason).toContain("Independent practitioner evidence disconfirms problem");
    });

    it("qualifies a feasible candidate corroborated across independent organizations", () => {
      const sig1 = {
        normalizedSignal: { id: "ns-1", canonicalUrl: "https://github.com/corp-a/infra/issues/10" },
        rawSignal: { sourceUrl: "https://github.com/corp-a/infra/issues/10", authorFingerprint: "corp-a-user" },
        source: { key: "github" },
      };
      const sig2 = {
        normalizedSignal: { id: "ns-2", canonicalUrl: "https://stackoverflow.com/questions/9910" },
        rawSignal: { sourceUrl: "https://stackoverflow.com/questions/9910", authorFingerprint: "corp-b-user" },
        source: { key: "stackexchange" },
      };

      const qual = evaluateCandidateQualification(
        { title: "Snowflake Resource Tag Drift", problemStatement: "Untagged warehouses cause unallocated billing spikes" },
        [sig1, sig2],
        [],
        { status: "HYPOTHESIS", isEligibleForVerified: false },
        68,
      );

      expect(qual.isEligibleForOpportunity).toBe(true);
      expect(qual.finalStatus).toBe("PUBLISHED");
      expect(qual.pubQualityStatus).toBe("HYPOTHESIS");
      expect(qual.qualificationReason).toContain("Qualified opportunity hypothesis");
    });
  });

  describe("In-Place Updates & Duplicate Prevention", () => {
    it("updates existing candidate in place instead of creating duplicate hex briefs", async () => {
      const prisma = createMockPrisma();

      // Create an initial candidate
      const initialCandidate = await prisma.opportunity.create({
        data: {
          slug: "snowflake-resource-tag-drift",
          title: "Snowflake Resource Tag Drift",
          problemStatement: "Untagged warehouses cause billing spikes",
          status: "DRAFT",
          publicationQualityStatus: "EVIDENCE_PENDING",
        },
      });

      const cluster = {
        clusterId: "cl-1",
        title: "Snowflake Resource Tag Drift",
        summary: "Untagged warehouses cause billing spikes",
        vertical: "DevOps & Compliance",
        signalIds: ["sig-1", "sig-2"],
        centroid: [0.1, 0.2],
      };

      const sig1 = {
        normalizedSignal: { id: "sig-1", signalType: "PAIN", canonicalUrl: "https://github.com/corp-a/infra/issues/10", actorRole: "DevOps Lead" },
        rawSignal: { id: "raw-1", sourceUrl: "https://github.com/corp-a/infra/issues/10", authorFingerprint: "corp-a" },
        source: { id: "src-gh", key: "github", name: "GitHub" },
      };
      const sig2 = {
        normalizedSignal: { id: "sig-2", signalType: "PAIN", canonicalUrl: "https://stackoverflow.com/questions/9910", actorRole: "Data Engineer" },
        rawSignal: { id: "raw-2", sourceUrl: "https://stackoverflow.com/questions/9910", authorFingerprint: "corp-b" },
        source: { id: "src-so", key: "stackexchange", name: "Stack Overflow" },
      };

      const result = await buildAndPersistOpportunityBrief(
        prisma,
        cluster,
        [sig1, sig2],
        Date.now() + 10000,
        new Set<string>(),
      );

      // Verify it updated the EXACT SAME record in place
      expect(result.opp.id).toBe(initialCandidate.id);
      expect(result.generatedSlug).toBe("snowflake-resource-tag-drift");
      expect(prisma._store.opportunities).toHaveLength(1); // NO duplicate created!

      // Verify status updated to PUBLISHED
      expect(result.finalStatus).toBe("PUBLISHED");
      expect(result.pubQualityStatus).toBe("HYPOTHESIS");

      // Verify revision records the qualification reason
      expect(prisma._store.revisions).toHaveLength(1);
      expect(prisma._store.revisions[0].reasonForChange).toContain("Qualified opportunity hypothesis");

      // Verify evidence links were created
      expect(prisma._store.evidenceLinks).toHaveLength(2);
      expect(prisma._store.evidenceLinks[0].relationshipType).toBe("SUPPORTS");
      expect(prisma._store.evidenceLinks[1].relationshipType).toBe("SUPPORTS");
    });
  });

  describe("Topic Similarity vs Problem Mechanics Regression (Run cd9e2129-3c9b-48cf-91a2-9b835e1b9278)", () => {
    it("distinguishes Kubernetes CPU limits silent OOMKill opportunity from kserve parent cgroup bug", async () => {
      const { signalsSupportSameProblem, evaluateCorroboratingEvidence } = await import("../src/index.js");

      const oppTitle = "CPU limits in Kubernetes cause misdiagnosed OOMKill and memory throttling";
      const oppStatement = "Setting CPU limits in Kubernetes causes container CFS quota throttling, which delays execution and manifests as misdiagnosed memory exhaustion or silent OOMKill degradation.";

      const kserveTitle = "cpu_count() misses CPU limits set on parent cgroups";
      const kserveBody = "kserve.utils.utils.cpu_count() reads the CPU limit only from the process's own cgroup (cpu.max on cgroup v2, cpu.cfs_quota_us on v1). It never looks at ancestor cgroups, so a limit set on a parent cgroup is not picked up and the function falls back to the node CPU count.";

      // Shared words 'kubernetes', 'cpu', 'limits' must NOT merge distinct problems
      expect(signalsSupportSameProblem(oppTitle, kserveTitle, oppStatement, kserveBody)).toBe(false);

      const evalResult = evaluateCorroboratingEvidence(
        { title: oppTitle, text: oppStatement, sourceKey: "hackernews", url: "https://news.ycombinator.com/item?id=49349908" },
        { title: kserveTitle, text: kserveBody, sourceKey: "github", url: "https://github.com/kserve/kserve/issues/6393" },
      );
      expect(evalResult.isIndependent).toBe(false);
      expect(evalResult.relationshipType).toBe("IRRELEVANT");
      expect(evalResult.rejectReason).toBe("KEYWORD_OVERLAP_ONLY");
    });

    it("distinguishes CrashLoopBackOff triage opportunity from CI/E2E test cluster preservation feature", async () => {
      const { signalsSupportSameProblem, isConcreteProblemOrWorkaround, evaluateCorroboratingEvidence } = await import("../src/index.js");

      const oppTitle = "Debugging Kubernetes CrashLoopBackOff requires jumping between logs and events";
      const oppStatement = "Debugging Kubernetes CrashLoopBackOff requires switching across logs, events, and pod states to diagnose container restart loops and termination exit codes.";

      const openShellTitle = "feat(e2e): preserve Kubernetes clusters for debugging";
      const openShellBody = "As an OpenShell contributor debugging a Kubernetes E2E failure, I want to preserve the ephemeral cluster and test artifacts after the run so that I can inspect the failed state directly. The Kubernetes E2E wrapper always deletes the k3d cluster and temporary work directory from its exit trap.";

      expect(signalsSupportSameProblem(oppTitle, openShellTitle, oppStatement, openShellBody)).toBe(false);
      expect(isConcreteProblemOrWorkaround({ title: openShellTitle, sanitizedExcerpt: openShellBody })).toBe(false);

      const evalResult = evaluateCorroboratingEvidence(
        { title: oppTitle, text: oppStatement, sourceKey: "hackernews", url: "https://news.ycombinator.com/item?id=47364723" },
        { title: openShellTitle, text: openShellBody, sourceKey: "github", url: "https://github.com/NVIDIA/OpenShell/issues/3675" },
      );
      expect(evalResult.isIndependent).toBe(false);
      expect(evalResult.relationshipType).toBe("IRRELEVANT");
    });

    it("distinguishes CrashLoopBackOff triage from local dev container mounting and Compose profiles", async () => {
      const { signalsSupportSameProblem, isConcreteProblemOrWorkaround } = await import("../src/index.js");

      const oppTitle = "Debugging Kubernetes CrashLoopBackOff requires jumping between logs and events";
      const oppStatement = "Debugging Kubernetes CrashLoopBackOff requires switching across logs, events, and pod states.";

      const honuaTitle = "feat(gp): container debugging with source mounts, a Compose integration profile, and a local Kubernetes Job harness";
      const honuaBody = "The complete native container-debugging/Compose-worker profile and local Kubernetes lifecycle matrix remain 2026.2.";

      expect(signalsSupportSameProblem(oppTitle, honuaTitle, oppStatement, honuaBody)).toBe(false);
      expect(isConcreteProblemOrWorkaround({ title: honuaTitle, sanitizedExcerpt: honuaBody })).toBe(false);
    });

    it("rejects synthetic AI benchmark scenario tasks as operational customer problems", async () => {
      const { signalsSupportSameProblem, isConcreteProblemOrWorkaround } = await import("../src/index.js");

      const oppTitle = "Diagnosing Kubernetes CrashLoopBackOff from logs is manual and fragmented";
      const oppStatement = "Diagnosing Kubernetes CrashLoopBackOff errors requires manual log inspection and correlation.";

      const benchmarkTitle = "[Scenario] Add a Kubernetes CrashLoopBackOff investigation case";
      const benchmarkBody = "Add a sanitized scenario under evals/scenarios/ for a Kubernetes workload repeatedly entering CrashLoopBackOff. Include ground truth, required evidence, red herrings.";

      expect(signalsSupportSameProblem(oppTitle, benchmarkTitle, oppStatement, benchmarkBody)).toBe(false);
      expect(isConcreteProblemOrWorkaround({ title: benchmarkTitle, sanitizedExcerpt: benchmarkBody })).toBe(false);
    });

    it("rejects certification exam prep checklists as customer problem friction", async () => {
      const { signalsSupportSameProblem, isConcreteProblemOrWorkaround } = await import("../src/index.js");

      const oppTitle = "Diagnosing Kubernetes CrashLoopBackOff from logs is manual and fragmented";
      const oppStatement = "Diagnosing Kubernetes CrashLoopBackOff errors requires manual log inspection.";

      const ckaTitle = "[TRBL-02] CrashLoopBackOff 원인 분석";
      const ckaBody = "## 학습 목표 [TRBL-02] CrashLoopBackOff 원인 분석 주제를 Kubernetes 관리자 관점에서 이해하고 직접 검증한다. kubectl get, describe, logs 등으로 상태를 확인한다.";

      expect(signalsSupportSameProblem(oppTitle, ckaTitle, oppStatement, ckaBody)).toBe(false);
      expect(isConcreteProblemOrWorkaround({ title: ckaTitle, sanitizedExcerpt: ckaBody })).toBe(false);
    });

    it("ensures feature requests with genuine customer pain are NOT disqualified by 'feat' prefix", async () => {
      const { signalsSupportSameProblem, isConcreteProblemOrWorkaround } = await import("../src/index.js");

      // 1. Feature request for Terraform state lock timeout
      const tfOppTitle = "Terraform State Lock acquisition error in CI pipeline";
      const tfOppStatement = "Deployment blocks when DynamoDB state lock fails to release cleanly.";
      const tfFeatTitle = "feat(terraform): retry mechanism for intermittent state lock acquisition timeout";
      const tfFeatBody = "Our automated Terraform pipeline halts because DynamoDB state lock fails to release cleanly, causing intermittent runner timeouts.";

      expect(isConcreteProblemOrWorkaround({ title: tfFeatTitle, sanitizedExcerpt: tfFeatBody })).toBe(true);
      expect(signalsSupportSameProblem(tfOppTitle, tfFeatTitle, tfOppStatement, tfFeatBody)).toBe(true);

      // 2. Feature request for vLLM CUDA OOM workaround
      const vllmOppTitle = "CUDA out-of-memory error during vLLM batching inference";
      const vllmOppStatement = "vLLM server restarts fail with out of memory error during concurrent requests.";
      const vllmFeatTitle = "feature(vllm): workaround for CUDA out of memory during long-context batching";
      const vllmFeatBody = "vLLM worker crashes intermittently with CUDA out-of-memory error when processing concurrent context requests.";

      expect(isConcreteProblemOrWorkaround({ title: vllmFeatTitle, sanitizedExcerpt: vllmFeatBody })).toBe(true);
      expect(signalsSupportSameProblem(vllmOppTitle, vllmFeatTitle, vllmOppStatement, vllmFeatBody)).toBe(true);

      // 3. Feature request for Prometheus memory leak
      const promOppTitle = "Prometheus memory leak causes unexpected pod crashes";
      const promOppStatement = "Prometheus container memory leak causes unexpected pod restarts and silent monitoring degradation.";
      const promFeatTitle = "feat: automated alert for Prometheus memory leak before OOMKill";
      const promFeatBody = "Prometheus memory leak causes unexpected pod crashes and OOMKill in production cluster.";

      expect(isConcreteProblemOrWorkaround({ title: promFeatTitle, sanitizedExcerpt: promFeatBody })).toBe(true);
      expect(signalsSupportSameProblem(promOppTitle, promFeatTitle, promOppStatement, promFeatBody)).toBe(true);
    });

    it("audits existing evidence links, removing SUPPORTS contribution while preserving source provenance", async () => {
      const { auditAndCleanMismatchedEvidenceLinks } = await import("../src/index.js");

      const mockPrisma = createMockPrisma();

      // Create opportunity
      const opp = await mockPrisma.opportunity.create({
        data: {
          slug: "kubernetes-cpu-limits-silently-cause-oomkills-that-are-misdi",
          title: "CPU limits in Kubernetes cause misdiagnosed OOMKill and memory throttling",
          problemStatement: "Setting CPU limits in Kubernetes causes container CFS quota throttling and silent OOMKill misdiagnoses.",
          status: "PUBLISHED",
          publicationQualityStatus: "HYPOTHESIS",
          isDemoFixture: false,
        },
      });

      // Raw and Normalized signal 1 (Genuine HN signal)
      const raw1 = {
        id: "raw-hn",
        sourceUrl: "https://news.ycombinator.com/item?id=49349908",
        title: "For the love of god stop using CPU limits in Kubernetes",
        rawContent: "Kubernetes CPU limits can cause memory issues and OOMKills. The actual cause is the CFS CPU limit.",
      };
      const ns1 = {
        id: "ns-hn",
        rawSignalId: raw1.id,
        rawSignal: raw1,
        sourceTitle: raw1.title,
        sanitizedExcerpt: raw1.rawContent,
        problemSummary: raw1.title,
        canonicalUrl: raw1.sourceUrl,
      };
      mockPrisma._store.rawSignals.push(raw1);
      mockPrisma._store.normalizedSignals.push(ns1);

      // Raw and Normalized signal 2 (Mismatched kserve signal)
      const raw2 = {
        id: "raw-kserve",
        sourceUrl: "https://github.com/kserve/kserve/issues/6393",
        title: "cpu_count() misses CPU limits set on parent cgroups",
        rawContent: "kserve.utils.utils.cpu_count() reads the CPU limit only from the process's own cgroup (cpu.max on cgroup v2, cpu.cfs_quota_us on v1). It never looks at ancestor cgroups.",
      };
      const ns2 = {
        id: "ns-kserve",
        rawSignalId: raw2.id,
        rawSignal: raw2,
        sourceTitle: raw2.title,
        sanitizedExcerpt: raw2.rawContent,
        problemSummary: raw2.title,
        canonicalUrl: raw2.sourceUrl,
      };
      mockPrisma._store.rawSignals.push(raw2);
      mockPrisma._store.normalizedSignals.push(ns2);

      // Create 2 EvidenceLinks
      const link1 = {
        id: "link-hn",
        opportunityId: opp.id,
        normalizedSignalId: ns1.id,
        normalizedSignal: ns1,
        relationshipType: "SUPPORTS",
      };
      const link2 = {
        id: "link-kserve",
        opportunityId: opp.id,
        normalizedSignalId: ns2.id,
        normalizedSignal: ns2,
        relationshipType: "SUPPORTS",
      };
      mockPrisma._store.evidenceLinks.push(link1, link2);

      // Create Scorecard
      mockPrisma._store.scorecards.push({
        id: "sc-1",
        opportunityId: opp.id,
        opportunityScore: 78,
        evidenceConfidenceScore: 74,
      });

      // Execute audit
      const auditResult = await auditAndCleanMismatchedEvidenceLinks(mockPrisma);

      // Verify 1 link was removed
      expect(auditResult.unlinkedCount).toBe(1);
      expect(auditResult.affectedSlugs).toContain("kubernetes-cpu-limits-silently-cause-oomkills-that-are-misdi");

      // Verify the kserve link was deleted from the opportunity
      const remainingLinks = mockPrisma._store.evidenceLinks.filter((l: any) => l.opportunityId === opp.id);
      expect(remainingLinks).toHaveLength(1);
      expect(remainingLinks[0].normalizedSignalId).toBe(ns1.id);

      // Verify source provenance is strictly preserved (rawSignal & normalizedSignal remain untouched in DB)
      expect(mockPrisma._store.rawSignals).toHaveLength(2);
      expect(mockPrisma._store.normalizedSignals).toHaveLength(2);
      expect(mockPrisma._store.rawSignals.some((r: any) => r.id === "raw-kserve")).toBe(true);
      expect(mockPrisma._store.normalizedSignals.some((n: any) => n.id === "ns-kserve")).toBe(true);
    });
  });
});
