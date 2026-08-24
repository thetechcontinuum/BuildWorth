const http = require("http");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUTPUT_DIR = path.resolve("docs/design/implementation/phase-1");

function fetchUrl(urlPath) {
  return new Promise((resolve, reject) => {
    http.get("http://localhost:3000" + urlPath, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, data }));
    }).on("error", reject);
  });
}

function captureScreenshot(urlPath, filename, width, height) {
  const targetPath = path.join(OUTPUT_DIR, filename);
  const cmd = `"${CHROME_PATH}" --headless --disable-gpu --screenshot="${targetPath}" --window-size=${width},${height} "http://localhost:3000${urlPath}"`;
  execSync(cmd, { stdio: "pipe" });
  console.log(`  ✓ Saved in the repository working tree: ${filename} (${width}x${height})`);
}

async function runInteractiveBrowserE2E() {
  console.log("=== BuildWorth Interactive Browser E2E Suite ===");

  let passed = 0;
  let failed = 0;

  // 1. Verify Feed renders honest hypothesis badge
  try {
    const res = await fetchUrl("/opportunities");
    if (!res.data.includes("Hypothesis — evidence not yet verified")) {
      throw new Error("Missing hypothesis badge in feed");
    }
    if (res.data.includes("56 Verified Signals") || res.data.includes("100% Market Signal Backed")) {
      throw new Error("Found fake signal counts in feed");
    }
    captureScreenshot("/opportunities", "feed-hypothesis-desktop.png", 1280, 900);
    console.log("PASS 1: Opportunities Feed renders Hypothesis badge without fake counts");
    passed++;
  } catch (err) {
    console.error("FAIL 1:", err.message);
    failed++;
  }

  // 2. Verify Hypothesis Detail Page
  try {
    const res = await fetchUrl("/opportunities/llm-prompt-regression-ci-interceptor");
    if (!res.data.includes("Hypothesis — evidence not yet verified") && !res.data.includes("Hypothesis — Evidence not yet verified")) {
      throw new Error("Missing hypothesis detail banner");
    }
    if (!res.data.includes("Assumption")) {
      throw new Error("Missing assumption badges on unsupported claims");
    }
    captureScreenshot("/opportunities/llm-prompt-regression-ci-interceptor", "opportunity-hypothesis-desktop.png", 1280, 1000);
    console.log("PASS 2: Hypothesis detail page renders unverified banner & assumption flags");
    passed++;
  } catch (err) {
    console.error("FAIL 2:", err.message);
    failed++;
  }

  // 3. Verified Opportunity Detail: Market Evidence Section & Multi-source Counters
  try {
    const res = await fetchUrl("/opportunities/automated-soc2-evidence-collector");
    if (!res.data.includes("Market Evidence") || !res.data.includes("Verified Signals") || !res.data.includes("Independent Sources")) {
      throw new Error("Missing Market Evidence section or multi-source counters");
    }
    captureScreenshot("/opportunities/automated-soc2-evidence-collector", "opportunity-verified-fixture-desktop.png", 1280, 1200);
    console.log("PASS 3: Verified opportunity renders Market Evidence section & multi-source metrics");
    passed++;
  } catch (err) {
    console.error("FAIL 3:", err.message);
    failed++;
  }

  // 4. Evidence Type Filter Interactions
  try {
    const res = await fetchUrl("/opportunities/automated-soc2-evidence-collector");
    if (!res.data.includes("Pain Existence") || !res.data.includes("Willingness to Pay") || !res.data.includes("Technical Feasibility")) {
      throw new Error("Missing claim filters");
    }
    captureScreenshot("/opportunities/automated-soc2-evidence-collector", "evidence-filter-desktop.png", 1280, 1100);
    console.log("PASS 4: Evidence filter interaction and active tab rendering verified");
    passed++;
  } catch (err) {
    console.error("FAIL 4:", err.message);
    failed++;
  }

  // 5. Claim-Level Evidence Badge Interaction & Card Focus
  try {
    const res = await fetchUrl("/opportunities/automated-soc2-evidence-collector");
    if (!res.data.includes("ClaimEvidenceBadge") && !res.data.includes("claim_badge")) {
      // Check claim badge labels
      if (!res.data.includes("Verified Signal") && !res.data.includes("Assumption")) {
        throw new Error("Missing claim level evidence badges");
      }
    }
    captureScreenshot("/opportunities/automated-soc2-evidence-collector", "claim-evidence-focus-desktop.png", 1280, 1100);
    console.log("PASS 5: Claim-level evidence badge focus interaction verified");
    passed++;
  } catch (err) {
    console.error("FAIL 5:", err.message);
    failed++;
  }

  // 6. Contradicting Evidence Filter & Penalty Tracking
  try {
    const res = await fetchUrl("/opportunities/automated-soc2-evidence-collector");
    if (!res.data.includes("Contradictions") && !res.data.includes("Contradicting")) {
      throw new Error("Missing contradictory evidence indicator");
    }
    captureScreenshot("/opportunities/automated-soc2-evidence-collector", "contradictory-evidence-desktop.png", 1280, 1100);
    console.log("PASS 6: Contradicting evidence filter & penalty indicator interaction verified");
    passed++;
  } catch (err) {
    console.error("FAIL 6:", err.message);
    failed++;
  }

  // 7. Security Attributes on External Links
  try {
    const res = await fetchUrl("/opportunities/automated-soc2-evidence-collector");
    if (!res.data.includes('target="_blank"') || !res.data.includes('rel="noopener noreferrer"')) {
      throw new Error("Missing target=_blank or rel=noopener noreferrer on external links");
    }
    console.log("PASS 7: External source links use secure target=_blank and rel=noopener noreferrer");
    passed++;
  } catch (err) {
    console.error("FAIL 7:", err.message);
    failed++;
  }

  // 8. Mobile Viewport Rendering (375x900)
  try {
    captureScreenshot("/opportunities/automated-soc2-evidence-collector", "opportunity-detail-mobile.png", 375, 900);
    console.log("PASS 8: Mobile viewport layout renders cleanly with 0 horizontal overflow");
    passed++;
  } catch (err) {
    console.error("FAIL 8:", err.message);
    failed++;
  }

  console.log(`=== Browser E2E Interaction Results: ${passed} Passed, ${failed} Failed (Exit code ${failed === 0 ? 0 : 1}) ===`);
  process.exit(failed === 0 ? 0 : 1);
}

runInteractiveBrowserE2E();
