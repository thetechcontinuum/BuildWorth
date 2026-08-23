import { AdapterType, RawIngestSignal, SourceAccessMethod, SourceHealthStatus } from "../types.js";
import { TokenBucketRateLimiter } from "../rate-limiter.js";

export abstract class BaseSourceAdapter {
  public abstract readonly sourceKey: string;
  public abstract readonly name: string;
  public abstract readonly adapterType: AdapterType;
  public abstract readonly accessMethod: SourceAccessMethod;
  public abstract readonly rateLimitPerMinute: number;
  public abstract readonly termsNotes: string;
  public abstract readonly attributionRequired: boolean;

  protected rateLimiter: TokenBucketRateLimiter | null = null;

  protected getLimiter(): TokenBucketRateLimiter {
    if (!this.rateLimiter) {
      this.rateLimiter = new TokenBucketRateLimiter(this.rateLimitPerMinute);
    }
    return this.rateLimiter;
  }

  public abstract fetchSignals(limit?: number): Promise<RawIngestSignal[]>;

  public getHealth(): SourceHealthStatus {
    return {
      sourceKey: this.sourceKey,
      name: this.name,
      adapterType: this.adapterType,
      accessMethod: this.accessMethod,
      rateLimitPerMinute: this.rateLimitPerMinute,
      isEnabled: true,
      termsNotes: this.termsNotes,
      attributionRequired: this.attributionRequired,
    };
  }
}
