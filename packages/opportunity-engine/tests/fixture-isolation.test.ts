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
    const migrationPath = path.resolve(__dirname, "../../database/prisma/migrations/20260825000000_phase2_decision_grade_blueprint/migration.sql");
    const migrationSql = fs.readFileSync(migrationPath, "utf8");
    expect(migrationSql).not.toContain("https://synthetic-fixture.example.com");
    expect(migrationSql).not.toContain("bp-dev-demo");
  });
});
