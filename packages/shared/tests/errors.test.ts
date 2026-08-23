import { describe, it, expect } from "vitest";
import { AppError, ValidationError, NotFoundError, KillSwitchError } from "../src/utils/errors.js";

describe("Error Hierarchy", () => {
  it("instantiates AppError with correct status code", () => {
    const err = new AppError("Test error", "TEST_CODE", 500);
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe("TEST_CODE");
  });

  it("instantiates ValidationError with 400 status", () => {
    const err = new ValidationError("Invalid field");
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
  });

  it("instantiates KillSwitchError with 503 status", () => {
    const err = new KillSwitchError("ingestion");
    expect(err.statusCode).toBe(503);
    expect(err.code).toBe("KILL_SWITCH_ACTIVE");
  });
});
