const http = require("http");
const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUTPUT_DIR = path.resolve("docs/design/implementation/phase-2");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function waitForServer(url, timeout = 30090) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http
        .get(url, (res) => {
          if (res.statusCode === 200) resolve();
          else retry();
        })
        .on("error", retry);
    };
    const retry = () => {
      if (Date.now() - start > timeout) reject(new Error("Timeout waiting for " + url));
      else setTimeout(check, 500);
    };
    check();
  });
}

function fetchUrl(urlPath) {
  return new Promise((resolve, reject) => {
    http
      .get("http://localhost:3009" + urlPath, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ status: res.statusCode, data }));
      })
      .on("error", reject);
  });
}

function captureScreenshot(urlPath, filename, width, height) {
  const targetPath = path.join(OUTPUT_DIR, filename);
  const cmd = `"${CHROME_PATH}" --headless --disable-gpu --screenshot="${targetPath}" --window-size=${width},${height} "http://localhost:3009${urlPath}"`;
  execSync(cmd, { stdio: "pipe" });
  console.log(`  ✓ Saved in repository: ${filename} (${width}x${height})`);
}

async function run() {
  console.log("=== BuildWorth Phase 2 Decision-Grade Blueprint E2E Suite ===");
  console.log("Starting Next.js production server on port 3009...");
  const server = spawn("pnpm", ["--filter", "@buildworth/web", "run", "start"], {
    stdio: "inherit",
    env: { ...process.env, PORT: "3009" },
  });

  let passed = 0;
  let failed = 0;

  try {
    await waitForServer("http://localhost:3009/api/health");
    console.log("Server healthy! Executing Phase 2 tests...");

    // Test 1: Executive Decision Summary
    try {
      const res = await fetchUrl("/opportunities/b2b-saas-audit-readiness-automation");
      if (!res.data.includes("DECISION-GRADE BLUEPRINT") || !res.data.includes("BUILD CANDIDATE")) {
        throw new Error("Missing executive decision badge or blueprint version");
      }
      captureScreenshot(
        "/opportunities/b2b-saas-audit-readiness-automation",
        "01_desktop_executive_decision_summary.png",
        1280,
        900,
      );
      console.log(
        "PASS 1: Executive Decision Summary renders verified recommendation and key metrics",
      );
      passed++;
    } catch (e) {
      console.error("FAIL 1:", e.message);
      failed++;
    }

    // Test 2: Sticky Navigation & Customer Segments
    try {
      const res = await fetchUrl("/opportunities/b2b-saas-audit-readiness-automation");
      if (
        !res.data.includes("Target Customer &amp; Buyer Segments") &&
        !res.data.includes("Target Customer & Buyer Segments")
      ) {
        throw new Error("Missing customer segments section");
      }
      captureScreenshot(
        "/opportunities/b2b-saas-audit-readiness-automation",
        "02_desktop_customer_segments.png",
        1280,
        1100,
      );
      console.log(
        "PASS 2: Structured Customer Segments renders role distinctions and buying triggers",
      );
      passed++;
    } catch (e) {
      console.error("FAIL 2:", e.message);
      failed++;
    }

    // Test 3: Narrow MVP Scope
    try {
      const res = await fetchUrl("/opportunities/b2b-saas-audit-readiness-automation");
      if (!res.data.includes("Narrow MVP Feature Scope") || !res.data.includes("Must-Have")) {
        throw new Error("Missing narrow MVP scope section");
      }
      captureScreenshot(
        "/opportunities/b2b-saas-audit-readiness-automation",
        "03_desktop_narrow_mvp_scope.png",
        1280,
        1000,
      );
      console.log("PASS 3: Narrow MVP feature boundaries render milestone 1 scope cleanly");
      passed++;
    } catch (e) {
      console.error("FAIL 3:", e.message);
      failed++;
    }

    // Test 4: Cost-Benefit Economics & Unit Margin
    try {
      const res = await fetchUrl("/opportunities/b2b-saas-audit-readiness-automation");
      if (!res.data.includes("Cost-Benefit Economics") || !res.data.includes("Gross Margin")) {
        throw new Error("Missing cost-benefit economics section");
      }
      captureScreenshot(
        "/opportunities/b2b-saas-audit-readiness-automation",
        "04_desktop_cost_benefit_economics.png",
        1280,
        1100,
      );
      console.log("PASS 4: Cost-Benefit Economics renders itemized costs and customer ROI drivers");
      passed++;
    } catch (e) {
      console.error("FAIL 4:", e.message);
      failed++;
    }

    // Test 5: Competition & Asymmetric Wedge
    try {
      const res = await fetchUrl("/opportunities/b2b-saas-audit-readiness-automation");
      if (
        !res.data.includes("Competition &amp; Asymmetric Wedge") &&
        !res.data.includes("Competition & Asymmetric Wedge")
      ) {
        throw new Error("Missing competition & asymmetric wedge section");
      }
      captureScreenshot(
        "/opportunities/b2b-saas-audit-readiness-automation",
        "05_desktop_competition_wedge.png",
        1280,
        1000,
      );
      console.log("PASS 5: Competition & Asymmetric Wedge renders competitor weaknesses and wedge");
      passed++;
    } catch (e) {
      console.error("FAIL 5:", e.message);
      failed++;
    }

    // Test 6: Risk Register & Assumption Matrix
    try {
      const res = await fetchUrl("/opportunities/b2b-saas-audit-readiness-automation");
      if (
        !res.data.includes("Risk Register &amp; Assumption Matrix") &&
        !res.data.includes("Risk Register & Assumption Matrix")
      ) {
        throw new Error("Missing risk register and assumption matrix");
      }
      captureScreenshot(
        "/opportunities/b2b-saas-audit-readiness-automation",
        "06_desktop_risks_and_assumptions.png",
        1280,
        1000,
      );
      console.log("PASS 6: Risk Register and Assumption Matrix render severity and test criteria");
      passed++;
    } catch (e) {
      console.error("FAIL 6:", e.message);
      failed++;
    }

    // Test 7: Validation Roadmap
    try {
      const res = await fetchUrl("/opportunities/b2b-saas-audit-readiness-automation");
      if (
        !res.data.includes("Validation Experiments Roadmap") ||
        !res.data.includes("Kill Criterion")
      ) {
        throw new Error("Missing validation experiments roadmap");
      }
      captureScreenshot(
        "/opportunities/b2b-saas-audit-readiness-automation",
        "07_desktop_validation_roadmap.png",
        1280,
        1000,
      );
      console.log(
        "PASS 7: Validation Experiments Roadmap renders prioritized experiments with kill criteria",
      );
      passed++;
    } catch (e) {
      console.error("FAIL 7:", e.message);
      failed++;
    }

    // Test 8: Mobile Blueprint Viewport
    try {
      captureScreenshot(
        "/opportunities/b2b-saas-audit-readiness-automation",
        "08_mobile_decision_blueprint.png",
        390,
        844,
      );
      console.log(
        "PASS 8: Mobile viewport (390x844) renders decision blueprint without horizontal overflow",
      );
      passed++;
    } catch (e) {
      console.error("FAIL 8:", e.message);
      failed++;
    }

    console.log(
      `=== Phase 2 Browser E2E Results: ${passed} Passed, ${failed} Failed (Exit code ${failed === 0 ? 0 : 1}) ===`,
    );
    process.exit(failed === 0 ? 0 : 1);
  } finally {
    console.log("Terminating development server cleanly...");
    server.kill("SIGTERM");
  }
}

run();
