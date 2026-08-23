# ADR 0002: PostgreSQL with pgvector for Relational and Embedding Storage

## Context

The platform requires relational integrity for multi-attribute opportunities, scorecards, audit logs, and vector similarity search for semantic problem clustering.

## Decision

Use PostgreSQL 16 with the `pgvector` extension managed via Prisma ORM. Store all monetary amounts in integer minor units (cents).

## Consequences

- Single operational datastore eliminates vector database sync latency and dual-write anomalies.
- Strict referential integrity between problem clusters, evidence signals, and scorecards.
