# Problem Intelligence & Clustering Architecture

## Pipeline Stages

1. **Sanitization & Extraction**: Strips prompt injection directives and parses structured facts (Actor, Task, Problem, Severity, Frequency, Intent to Pay).
2. **Embedding Generation**: Vector embeddings generated and indexed via PostgreSQL `pgvector`.
3. **Semantic Clustering**: Cosine similarity clustering groups related market signals into coherent Problem Spaces.
4. **Budget Guardrails**: Every LLM call passes through `AiSpendLedger` with strict daily ($5.00) & monthly ($150.00) kill switches.
