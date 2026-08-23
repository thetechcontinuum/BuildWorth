export class TokenBucketRateLimiter {
  private capacity: number;
  private refillRatePerMs: number;
  private tokens: number;
  private lastRefill: number;

  constructor(maxPerMinute: number) {
    this.capacity = maxPerMinute;
    this.tokens = maxPerMinute;
    this.refillRatePerMs = maxPerMinute / (60 * 1000);
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRatePerMs);
    this.lastRefill = now;
  }

  public async acquire(): Promise<boolean> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  public async waitForToken(maxWaitMs = 5000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      if (await this.acquire()) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  }
}
