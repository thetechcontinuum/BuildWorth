import { BaseSourceAdapter } from "./adapters/base.js";
import { HackerNewsAdapter } from "./adapters/hackernews.js";
import { RedditAdapter } from "./adapters/reddit.js";
import { GitHubIssuesAdapter } from "./adapters/github.js";
import { ProductHuntAdapter } from "./adapters/producthunt.js";
import { SourceHealthStatus } from "./types.js";

export class SourceRegistry {
  private adapters: Map<string, BaseSourceAdapter> = new Map();

  constructor() {
    this.register(new HackerNewsAdapter());
    this.register(new RedditAdapter());
    this.register(new GitHubIssuesAdapter());
    this.register(new ProductHuntAdapter());
  }

  public register(adapter: BaseSourceAdapter): void {
    this.adapters.set(adapter.sourceKey, adapter);
  }

  public getAdapter(sourceKey: string): BaseSourceAdapter | undefined {
    return this.adapters.get(sourceKey);
  }

  public getAllAdapters(): BaseSourceAdapter[] {
    return Array.from(this.adapters.values());
  }

  public getHealthStatuses(): SourceHealthStatus[] {
    return this.getAllAdapters().map((a) => a.getHealth());
  }
}

export const sourceRegistry = new SourceRegistry();
