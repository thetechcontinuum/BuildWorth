# BuildWorth — Startup Opportunity Radar

> **Evidence-First Startup & B2B SaaS Opportunity Intelligence Platform**

BuildWorth automatically discovers, analyzes, scores, ranks, and publishes empirical, signal-backed startup opportunities. It eliminates generic, hallucinated AI ideas by enforcing strict evidence requirements from observable customer pain, complaints, expensive manual workarounds, and procurement triggers.

---

## Key Platform Architectural Pillars

### 1. Dual-Scoring Model (Decoupled Promise & Proof)

- **Opportunity Score (0–100)**: Evaluates structural market appeal across 9 fixed dimensions (Pain Severity, Willingness to Pay, Feasibility, Unit Economics, Market Size, Buyer Accessibility, Competition, Speed to Validation, Defensibility).
- **Evidence Confidence Score (0–100)**: Evaluates empirical grounding across source credibility, corroboration count ($n \ge 2$), source diversity, exponential recency decay, and direct buyer intent.
- **Hypothesis Guardrail**: Opportunities scoring $\ge 70$ Opportunity Score with $< 50$ Confidence are explicitly tagged as **"Hypothesis (Low Evidence)"**.

### 2. Multi-Source Ingestion & Prompt-Injection Defense

- Ingests from **Hacker News**, **Reddit Tech & Ops**, **GitHub Issues**, and **Product Hunt**.
- Content Sanitizer strips scripts/HTML and neutralizes prompt-injection payloads (`[redacted_directive]`).
- Token-bucket rate limiting and SHA-256 content deduplication per connector.

### 3. Problem Clustering & Semantic Analysis (`pgvector`)

- Pure vector math (`cosineSimilarity`, `computeCentroid`) clusters disparate signals into distinct **Problem Spaces**.
- Extracts actor roles, severity, frequency, and existing manual workarounds.

### 4. 40-Attribute Venture Blueprints & Adversarial Critic

- Generates comprehensive 40-attribute venture blueprints including economic buyer, end user, narrow MVP scope, defensibility, and assumptions.
- Models unit economics: MVP build cost, monthly operating cost, customer labor hours saved, gross margin ($85\%$), and break-even customer scenarios.
- Adversarial Critic rejects blueprints lacking multi-source corroboration or specific buyer personas.

### 5. Production Next.js 14+ Applications

- **Public Research Portal (`apps/web`)**: Interactive multi-filter feed, full-text instant search, 9-dimension score explanation breakdowns, side-by-side comparison mode, and investor dossier exports.
- **Operations & Review Portal (`apps/admin`)**: Human-in-the-loop manual review queue, problem space explorer, connector telemetry, AI spend ledger, and emergency kill-switches.

---

## Monorepo Package Structure

```
BuildWorth/
├── apps/
│   ├── web/                     # Next.js 14+ Public Research Portal
│   ├── admin/                   # Next.js 14+ Operations & Review Queue Portal
│   ├── worker/                  # Background task & pipeline worker
│   └── scheduler/               # Ingestion & budget reset cron scheduler
├── packages/
│   ├── shared/                  # Domain types, integer minor-unit money arithmetic
│   ├── config/                  # Type-safe environment & system constants
│   ├── validation/              # Zod validation schemas for all domain models
│   ├── scoring/                 # 100-point Opportunity Score & Confidence Engine
│   ├── observability/           # Structured JSON logger & AI spend ledger
│   ├── database/                # Prisma ORM schema (18 models) & pgvector client
│   ├── ui/                      # Tailwind UI tokens, ScoreBadge, ConfidenceMeter
│   ├── ai/                      # Provider gateway (Gemini/OpenAI/Claude/Mock) & spend tracking
│   ├── source-connectors/       # HN, Reddit, GitHub, Product Hunt ingestion adapters
│   └── opportunity-engine/      # Vector clustering, synthesizer, critic, economics, pipeline
└── docs/                        # Complete architecture decisions & operations runbooks
```

---

## Quick Start Guide

### Prerequisites

- Node.js `>= 20.0.0`
- `pnpm >= 10.0.0`
- PostgreSQL 16+ with `pgvector` extension

### Installation & Build

```bash
# 1. Install dependencies across all 15 workspaces
pnpm install

# 2. Build all packages and applications
pnpm run build

# 3. Run all unit and integration test suites (39 tests)
pnpm test

# 4. Strict TypeScript type check
pnpm run typecheck
```

### Run Local Development Servers

```bash
# Starts both web (http://localhost:3000) and admin (http://localhost:3001) in parallel
pnpm dev
```

### Execute the 20-Step Discovery Pipeline

```bash
pnpm run pipeline:run
```

---

## Deployment to Vercel

The monorepo is pre-configured with `vercel.json` for zero-friction Vercel deployment:

1. Set **Root Directory** to `apps/web` for the public web app.
2. Set **Root Directory** to `apps/admin` for the admin console.
3. Configure environment variables following [`.env.example`](.env.example).
4. See full instructions in [`docs/operations/vercel-deployment.md`](docs/operations/vercel-deployment.md).

---

## Quality & Test Status

- **Build**: 15/15 workspaces passing.
- **Typecheck**: 25/25 tasks passing (strict TypeScript, 0 errors).
- **Tests**: 39/39 passing across all packages.
- **Formatting**: Verified with Prettier.
