# ADR 0003: Decoupled Dual Scoring and Evidence Confidence Model

## Context

Generic AI idea generators present unverified ideas with inflated confidence. We need to distinguish between intrinsic opportunity appeal and supporting empirical evidence.

## Decision

Strictly decouple:

1. **Opportunity Score (0–100)**: Evaluated over a fixed 9-dimension 100-point rubric.
2. **Evidence Confidence (0–100)**: Measured across source credibility, diversity, volume, recency decay, and intent directness.

Any opportunity with Opportunity Score >= 70 but Evidence Confidence < 50 is automatically marked as **Hypothesis (Low Evidence)**.
