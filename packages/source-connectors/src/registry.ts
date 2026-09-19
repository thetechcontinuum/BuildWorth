import { BaseSourceAdapter } from "./adapters/base.js";
import { HackerNewsAdapter } from "./adapters/hackernews.js";
import { RedditAdapter } from "./adapters/reddit.js";
import { GitHubIssuesAdapter } from "./adapters/github.js";
import { ProductHuntAdapter } from "./adapters/producthunt.js";
import { KrAsiaAdapter } from "./adapters/krasia.js";
import { E27Adapter } from "./adapters/e27.js";
import { GenericRssAdapter, GenericRssConfig } from "./adapters/generic-rss.js";
import { SourceHealthStatus } from "./types.js";

export class SourceRegistry {
  private adapters: Map<string, BaseSourceAdapter> = new Map();

  constructor() {
    this.register(new HackerNewsAdapter());
    this.register(new RedditAdapter());
    this.register(new GitHubIssuesAdapter());
    this.register(new ProductHuntAdapter());
    this.register(new KrAsiaAdapter());
    this.register(new E27Adapter());
  }

  public register(adapter: BaseSourceAdapter): void {
    this.adapters.set(adapter.sourceKey, adapter);
  }

  public getAdapter(sourceKey: string): BaseSourceAdapter | undefined {
    return this.adapters.get(sourceKey);
  }

  public createGenericRssAdapter(config: GenericRssConfig): GenericRssAdapter {
    const adapter = new GenericRssAdapter(config);
    this.register(adapter);
    return adapter;
  }

  public getAllAdapters(): BaseSourceAdapter[] {
    return Array.from(this.adapters.values());
  }

  public getHealthStatuses(): SourceHealthStatus[] {
    return this.getAllAdapters().map((a) => a.getHealth());
  }
}

export const sourceRegistry = new SourceRegistry();
