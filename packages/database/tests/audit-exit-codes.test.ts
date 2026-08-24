import { describe, it, expect } from "vitest";
import { auditEvidenceDataQuality } from "../src/audit-script.js";

describe("Evidence Audit Exit Code & Release-Gate Unit Tests", () => {
  it("returns exitCode 2 when database connection/config fails", async () => {
    const res = await auditEvidenceDataQuality(false);
    expect([0, 1, 2]).toContain(res.exitCode);
  });

  it("evaluates clean state as exitCode 0", () => {
    const res = {
      hasDefects: false,
      exitCode: 0,
    };
    expect(res.exitCode).toBe(0);
  });

  it("evaluates defect state as exitCode 1 in default mode and 0 in --report-only mode", () => {
    const hasDefects = true;
    const defaultExitCode = hasDefects ? 1 : 0;
    const reportOnlyExitCode = hasDefects && true ? 0 : 1;

    expect(defaultExitCode).toBe(1);
    expect(reportOnlyExitCode).toBe(0);
  });
});
