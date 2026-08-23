# Vercel Deployment Runbook

## Overview

BuildWorth is deployed to Vercel with `apps/web` serving the public platform and `apps/admin` serving the operations portal.

## Deployment Steps

1. **Repository Setup**: Link the GitHub repository in the Vercel Dashboard.
2. **Root Directory**: Set Root Directory to `apps/web` (or `apps/admin`).
3. **Build Command**: `pnpm run db:generate && pnpm run build`
4. **Environment Variables**:
   - `DATABASE_URL`: PostgreSQL connection string with pgvector enabled.
   - `AUTH_SECRET`: High-entropy 32+ character key.
   - `AI_DAILY_SPEND_LIMIT_CENTS`: e.g. `500` ($5/day).
   - `AI_MONTHLY_SPEND_LIMIT_CENTS`: e.g. `15000` ($150/month).
