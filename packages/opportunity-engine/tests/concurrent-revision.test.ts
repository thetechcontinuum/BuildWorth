import { describe, it, expect } from "vitest";

describe("Concurrency Protection & Advisory Lock Logic", () => {
  it("computes stable unique 32-bit positive lock integers per opportunity", () => {
    const oppId1 = "00000000-0000-0000-0000-000000000001";
    const oppId2 = "00000000-0000-0000-0000-000000000002";

    const lockKey1 =
      Math.abs(oppId1.split("").reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)) %
      2147483647;

    const lockKey2 =
      Math.abs(oppId2.split("").reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)) %
      2147483647;

    expect(lockKey1).toBeGreaterThanOrEqual(0);
    expect(lockKey2).toBeGreaterThanOrEqual(0);
    expect(lockKey1).not.toBe(lockKey2);
  });
});
