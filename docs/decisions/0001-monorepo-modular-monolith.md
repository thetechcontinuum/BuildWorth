# ADR 0001: Monorepo with Modular Monolith Architecture

## Context

We need a robust platform that hosts both customer-facing research interfaces and complex background intelligence pipelines while maintaining developer speed, strict type-safety, and minimal operational complexity.

## Decision

Adopt a pnpm + Turborepo monorepo structuring the system as a Modular Monolith.

- Apps: `web`, `admin`, `worker`, `scheduler`.
- Packages: `database`, `shared`, `scoring`, `observability`, `validation`, `config`, `ui`.

## Consequences

- Single type registry across frontend, backend, scoring, and DB.
- Zero premature microservice overhead.
