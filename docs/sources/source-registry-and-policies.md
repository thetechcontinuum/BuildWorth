# Source Adapter Registry & Terms Compliance

## Compliance Principles

1. **Zero Complete Reproduction**: Store only extracted structured entities, cryptographic fingerprints, and short excerpts ($\le 280$ chars).
2. **Mandatory Attribution**: Every ingested signal references the original canonical URL and source attribution.
3. **Strict Rate Limiting**: All connectors enforce token-bucket rate limits with exponential backoff on HTTP 429/503.
4. **Prompt Injection Defense**: Ingestion strips HTML/script tags and sanitizes prompt injection commands before embedding or storing.

## Registered Adapters

| Adapter Key     | Source Name                    | Access Method               | Rate Limit  | Storage Limit           | Evidence Type / Role                                             |
| :-------------- | :----------------------------- | :-------------------------- | :---------- | :---------------------- | :--------------------------------------------------------------- |
| `hackernews`    | Hacker News                    | Algolia / Firebase REST API | 120 req/min | Excerpt $\le 280$ chars | Developer pain points and workflow discussions                   |
| `reddit`        | Reddit Tech & Ops              | OAuth 2.0 Official API      | 60 req/min  | Excerpt $\le 280$ chars | Practitioner complaints and tooling workarounds                  |
| `github`        | GitHub Issues                  | REST / GraphQL API with PAT | 80 req/min  | Excerpt $\le 280$ chars | Concrete software bugs, friction, and feature requests           |
| `producthunt`   | Product Hunt                   | GraphQL API / RSS           | 60 req/min  | Excerpt $\le 280$ chars | Product reviews, user feedback, and market gaps                  |
| `ted`           | TED Europa Tenders             | REST API (api.ted.europa.eu)| 60 req/min  | Excerpt $\le 280$ chars | Public buyer demand, government tenders, and procurement budgets |
| `samgov`        | SAM.gov Federal Contracting    | REST API with API Key       | 30 req/min  | Excerpt $\le 280$ chars | US federal contracting solicitations and agency requirements     |
| `stackexchange` | Stack Exchange & StackOverflow | REST API v2.3               | 60 req/min  | Excerpt $\le 280$ chars | Recurring technical questions, tooling errors, and workarounds   |
| `cisakev`       | CISA KEV Catalog               | HTTPS JSON Catalog          | 30 req/min  | Excerpt $\le 280$ chars | Confirmed in-the-wild exploited security vulnerabilities         |
| `arxiv`         | arXiv Research Preprints       | HTTPS Atom Export API       | 20 req/min  | Excerpt $\le 280$ chars | Scientific preprints and emerging technology trend indicators    |
| `krasia`        | KrASIA                         | RSS Feed                    | 60 req/min  | Excerpt $\le 280$ chars | Market activity and tech ecosystem news                          |
| `siliconcanals` | Silicon Canals                 | RSS Feed                    | 30 req/min  | Excerpt $\le 280$ chars | European startup news and tech ecosystem developments            |
| `lobsters`      | Lobsters                       | RSS Feed                    | 30 req/min  | Excerpt $\le 280$ chars | Developer discussions and computing friction                     |
