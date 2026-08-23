import { describe, it, expect } from "vitest";
import { TokenBucketRateLimiter } from "../src/rate-limiter.js";

describe("Rate Limiter", () => {
  it("allows requests within capacity", async () => {
    const limiter = new TokenBucketRateLimiter(60);
    const acquired = await limiter.acquire();
    expect(acquired).toBe(true);
  });
});
