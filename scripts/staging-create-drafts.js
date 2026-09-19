#!/usr/bin/env node
// BuildWorth Staging Draft Generation CLI
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
  let rawUrl = process.env.STAGING_URL;
  if (!rawUrl) {
    console.error("Error: STAGING_URL environment variable is required.");
    process.exit(1);
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch (err) {
    console.error("Invalid STAGING_URL format:", rawUrl);
    process.exit(1);
  }

  if (isForbiddenHost(parsedUrl.hostname)) {
    console.error(`Safety error: Host ${parsedUrl.hostname} is not an allowed staging deployment target.`);
    process.exit(1);
  }

  const secret = await promptSecret("Enter Staging CRON_SECRET: ");
  if (!secret) {
    console.error("Error: CRON_SECRET cannot be empty.");
    process.exit(1);
  }

  const targetEndpoint = `${parsedUrl.origin}/api/internal/drafts/create-from-discovery`;
  console.log(`\nTriggering draft generation on Staging: ${targetEndpoint}`);

  const res = await fetch(targetEndpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error(`Request failed with HTTP ${res.status}: ${txt}`);
    process.exit(1);
  }

  const data = await res.json();
  console.log("\n=== Draft Opportunities Generation Report ===");
  console.log(`Drafts Created: ${data.draftsCreated}`);
  console.log("\n--- Created Drafts ---");
  (data.drafts || []).forEach((d, i) => {
    console.log(`\n[Draft ${i + 1}] ${d.title}`);
    console.log(`  ID                   : ${d.id}`);
    console.log(`  Slug                 : ${d.slug}`);
    console.log(`  Status               : ${d.status}`);
    console.log(`  Quality Status       : ${d.publicationQualityStatus}`);
    console.log(`  Source URL           : ${d.sourceUrl}`);
    console.log(`  Original Market      : ${d.originalMarket}`);
    console.log(`  EU/Croatia Hypothesis: ${d.potentialEuAdaptation}`);
    console.log(`  Inspect URL          : ${parsedUrl.origin}${d.inspectUrl}`);
  });

  if (data.nonViableArticles && data.nonViableArticles.length > 0) {
    console.log("\n--- Excluded / Non-Viable Discovery Articles ---");
    data.nonViableArticles.forEach((a, i) => {
      console.log(`\n[Excluded ${i + 1}] ${a.title}`);
      console.log(`  URL   : ${a.url}`);
      console.log(`  Reason: ${a.reason}`);
    });
  }
}

main().catch((err) => {
  console.error("Fatal execution error:", err);
  process.exit(1);
});
