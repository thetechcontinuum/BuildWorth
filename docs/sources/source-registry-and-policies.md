# Source Adapter Registry & Terms Compliance

## Compliance Principles

1. **Zero Complete Reproduction**: Store only extracted structured entities, cryptographic fingerprints, and short excerpts ($\le 280$ chars).
2. **Mandatory Attribution**: Every ingested signal references the original canonical URL and source attribution.
3. **Strict Rate Limiting**: All connectors enforce token-bucket rate limits with exponential backoff on HTTP 429/503.
4. **Prompt Injection Defense**: Ingestion strips HTML/script tags and sanitizes prompt injection commands before embedding or storing.

## Registered Adapters

| Adapter Key   | Source Name       | Access Method               | Rate Limit  | Storage Limit           |
| :------------ | :---------------- | :-------------------------- | :---------- | :---------------------- |
| `hackernews`  | Hacker News       | Algolia / Firebase REST API | 120 req/min | Excerpt $\le 280$ chars |
| `reddit`      | Reddit Tech & Ops | OAuth 2.0 Official API      | 60 req/min  | Excerpt $\le 280$ chars |
| `github`      | GitHub Issues     | REST / GraphQL API with PAT | 80 req/min  | Excerpt $\le 280$ chars |
| `producthunt` | Product Hunt      | GraphQL API / RSS           | 60 req/min  | Excerpt $\le 280$ chars |
