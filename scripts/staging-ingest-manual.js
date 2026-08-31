#!/usr/bin/env node

const crypto = require("crypto");
const readline = require("readline");

const FORBIDDEN_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\.0\.0\.1$/,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /buildworth\.io$/i,
  /^build-worth-web\.vercel\.app$/i,
];

function isForbiddenHost(hostname) {
  return FORBIDDEN_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
}

async function promptSecret(promptText) {
  if (process.env.CRON_SECRET && process.env.CRON_SECRET.trim().length > 0) {
    return process.env.CRON_SECRET.trim();
  }

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    if (process.stdin.isTTY) {
      process.stdout.write(promptText);
      process.stdin.setRawMode?.(true);
      let secret = "";

      process.stdin.on("data", (char) => {
        const c = char.toString("utf8");
        if (c === "\n" || c === "\r" || c === "\u0004") {
          process.stdin.setRawMode?.(false);
          process.stdout.write("\n");
          rl.close();
          resolve(secret.trim());
        } else if (c === "\u0003") {
          process.exit(1);
        } else if (c === "\u007f" || c === "\b") {
          if (secret.length > 0) secret = secret.slice(0, -1);
        } else {
          secret += c;
        }
      });
    } else {
      rl.question(promptText, (ans) => {
        rl.close();
        resolve(ans.trim());
      });
    }
  });
}

async function main() {
  const args = process.argv.slice(2);
  let rawUrl = process.env.STAGING_URL;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--url" && args[i + 1]) {
      rawUrl = args[i + 1];
      i++;
    } else if (args[i].startsWith("--url=")) {
      rawUrl = args[i].split("=")[1];
    } else if (!args[i].startsWith("--") && !rawUrl) {
      rawUrl = args[i];
    }
  }

  if (!rawUrl) {
    console.error("Error: STAGING_URL is required. Provide via environment variable STAGING_URL or --url <url>");
    process.exit(1);
  }

  let stagingUrl;
  try {
    const parsed = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
    if (isForbiddenHost(parsed.hostname)) {
      console.error(`Error: Refusing to execute on forbidden host: ${parsed.hostname}. Manual staging ingestion only allowed on isolated staging environments.`);
      process.exit(1);
    }
    stagingUrl = parsed.origin;
  } catch (err) {
    console.error("Error: Invalid STAGING_URL provided.");
    process.exit(1);
  }

  const secret = await promptSecret("Enter CRON_SECRET: ");
  if (!secret) {
    console.error("Error: CRON_SECRET is required to authenticate staging ingestion.");
    process.exit(1);
  }

  const idempotencyKey = `manual-staging-${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;

  console.log("=== BuildWorth Staging Manual Ingestion Run ===");
  console.log(`Target: ${stagingUrl}`);
  console.log(`Idempotency-Key: ${idempotencyKey}`);
  console.log("Submitting ingestion trigger request...");

  try {
    const postRes = await fetch(`${stagingUrl}/api/internal/ingestion/run`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${secret}`,
        "Idempotency-Key": idempotencyKey,
        "Content-Type": "application/json",
        ...(process.env.VERCEL_OIDC_TOKEN ? { "x-vercel-protection-bypass": process.env.VERCEL_OIDC_TOKEN } : {}),
        ...(process.env.VERCEL_PROTECTION_BYPASS ? { "x-vercel-protection-bypass": process.env.VERCEL_PROTECTION_BYPASS } : {}),
      },
    });

    const postData = await postRes.json();

    if (!postRes.ok && postRes.status !== 409) {
      console.error(`Ingestion trigger failed with HTTP ${postRes.status}`);
      if (postData.error) console.error(`Reason: ${postData.error}`);
      if (postData.message) console.error(`Message: ${postData.message}`);
      process.exit(1);
    }

    const run = postData.run || postData;
    let runId = run.id || run.runId;

    if (!runId && postRes.ok) {
      console.log("Ingestion completed synchronously.");
      printSummary(run);
      return;
    }

    if (run.status === "COMPLETED" || run.status === "FAILED") {
      printSummary(run);
      if (run.status === "FAILED") process.exit(1);
      return;
    }

    // Poll status endpoint
    console.log(`Run active (ID: ${runId}). Polling status...`);
    const pollStart = Date.now();
    const pollTimeout = 60000;

    while (Date.now() - pollStart < pollTimeout) {
      await new Promise((r) => setTimeout(r, 2000));

      const pollRes = await fetch(`${stagingUrl}/api/internal/ingestion/run/${runId}`, {
        headers: {
          "Authorization": `Bearer ${secret}`,
        },
      });

      if (!pollRes.ok) {
        console.warn(`Polling check returned status ${pollRes.status}...`);
        continue;
      }

      const pollData = await pollRes.json();
      const current = pollData.run || pollData;

      if (current.status === "COMPLETED" || current.status === "FAILED") {
        printSummary(current);
        if (current.status === "FAILED") process.exit(1);
        return;
      }
    }

    console.error("Polling timed out before ingestion run reached terminal status.");
    process.exit(1);
  } catch (fetchErr) {
    console.error("Network or execution error communicating with staging endpoint:", fetchErr.message);
    process.exit(1);
  }
}

function printSummary(run) {
  console.log("\n=== Ingestion Run Final Report ===");
  console.log(`Status         : ${run.status}`);
  if (run.failureCode) console.log(`Failure Code   : ${run.failureCode}`);
  const counters = run.counters || {};
  console.log(`Fetched Items  : ${counters.fetched ?? run.totalFetched ?? 0}`);
  console.log(`Deduplicated   : ${counters.deduplicated ?? run.totalDeduplicated ?? 0}`);
  console.log(`Raw Signals    : ${counters.rawSignals ?? run.rawSignalsCount ?? 0}`);
  console.log(`Candidates     : ${counters.candidates ?? run.candidatesCount ?? 0}`);
  console.log(`Published      : ${counters.published ?? run.publishedCount ?? 0}`);
  
  const slugs = run.publishedSlugs || [];
  console.log(`Published Slugs: ${slugs.length > 0 ? slugs.join(", ") : "(none)"}`);
  if (run.startedAt) console.log(`Started At     : ${run.startedAt}`);
  if (run.completedAt) console.log(`Completed At   : ${run.completedAt}`);
  if (run.failedAt) console.log(`Failed At      : ${run.failedAt}`);
  console.log("==================================\n");
}

main().catch((err) => {
  console.error("Fatal error running staging ingestion CLI:", err.message);
  process.exit(1);
});
