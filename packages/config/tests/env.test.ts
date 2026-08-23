import { describe, it, expect } from "vitest";
import { getEnv, APP_CONSTANTS } from "../src/index.js";

describe("Configuration & Environment", () => {
  it("provides valid defaults when process.env is minimal", () => {
    const env = getEnv();
    expect(env.DATABASE_URL).toBeDefined();
    expect(env.AI_DAILY_SPEND_LIMIT_CENTS).toBe(500);
  });

  it("exports core constants", () => {
    expect(APP_CONSTANTS.DEFAULT_CURRENCY).toBe("USD");
    expect(APP_CONSTANTS.HYPOTHESIS_CONFIDENCE_THRESHOLD).toBe(50);
  });
});
