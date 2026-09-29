import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs";
import { MOCK_BLUEPRINT_DEV_FIXTURE } from "../../../apps/web/src/lib/blueprint-fixtures.js";

describe("Production Fixture Isolation Tests", () => {
  it("confirms dev blueprint fixtures have explicit fixture IDs and are isolated from production databases", () => {
    expect(MOCK_BLUEPRINT_DEV_FIXTURE.id).toMatch(/^bp-soc2-canonical/);
    expect(MOCK_BLUEPRINT_DEV_FIXTURE.opportunityRevisionId).toMatch(/^rev-soc2-canonical/);
  });

  it("verifies migration files contain zero synthetic fixture URLs", () => {
    const migrationPath = path.resolve(
      __dirname,
      "../../database/prisma/migrations/20260825000000_phase2_decision_grade_blueprint/migration.sql",
    );
    const migrationSql = fs.readFileSync(migrationPath, "utf8");
    expect(migrationSql).not.toContain("https://synthetic-fixture.example.com");
    expect(migrationSql).not.toContain("bp-dev-demo");
  });

  it("verifies INITIAL_OPPORTUNITIES fixture slugs are never exposed as fallback in production client feed", () => {
    const fixtureSlugs = [
      "automated-soc2-evidence-collector",
      "llm-prompt-regression-ci-interceptor",
      "snowflake-runaway-query-circuit-breaker",
      "postgres-pool-exhaustion-watchdog-nextjs",
    ];

    const feedClientPath = path.resolve(__dirname, "../../../apps/web/src/components/OpportunityFeedClient.tsx");
    const feedClientContent = fs.readFileSync(feedClientPath, "utf8");

    // Client component must not import INITIAL_OPPORTUNITIES or hardcode fixture slugs
    expect(feedClientContent).not.toContain("INITIAL_OPPORTUNITIES");
    for (const slug of fixtureSlugs) {
      expect(feedClientContent).not.toContain(slug);
    }
  });

  it("verifies /api/opportunities route does not fall back to INITIAL_OPPORTUNITIES or getAllStoredOpportunities", () => {
    const routePath = path.resolve(__dirname, "../../../apps/web/src/app/api/opportunities/route.ts");
    const routeContent = fs.readFileSync(routePath, "utf8");

    expect(routeContent).not.toContain("INITIAL_OPPORTUNITIES");
    expect(routeContent).not.toContain("getAllStoredOpportunities");
  });

  it("verifies homepage and HomeTopOpportunitiesClient do not contain hardcoded fixture opportunities", () => {
    const fixtureSlugs = [
      "automated-soc2-evidence-collector",
      "llm-prompt-regression-ci-interceptor",
      "snowflake-runaway-query-circuit-breaker",
      "postgres-pool-exhaustion-watchdog-nextjs",
    ];

    const homePagePath = path.resolve(__dirname, "../../../apps/web/src/app/page.tsx");
    const homeContent = fs.readFileSync(homePagePath, "utf8");
    const clientPath = path.resolve(__dirname, "../../../apps/web/src/components/HomeTopOpportunitiesClient.tsx");
    const clientContent = fs.readFileSync(clientPath, "utf8");

    expect(homeContent).not.toContain("featuredOpportunities");
    for (const slug of fixtureSlugs) {
      expect(homeContent).not.toContain(slug);
      expect(clientContent).not.toContain(slug);
    }
  });
});
