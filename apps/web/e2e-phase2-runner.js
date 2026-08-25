
import { chromium } from "playwright";
import { spawn } from "child_process";
import http from "http";
import path from "path";
import fs from "fs";

function waitForServer(url, timeout = 45000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http.get(url, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          retry();
        }
      }).on("error", () => {
        retry();
      });
    };
    const retry = () => {
      if (Date.now() - start > timeout) {
        reject(new Error("Timeout waiting for server at " + url));
      } else {
        setTimeout(check, 1000);
      }
    };
    check();
  });
}

async function run() {
  console.log("Starting Next.js production server on port 3000...");
  const server = spawn("pnpm", ["--filter", "@buildworth/web", "run", "start"], {
    stdio: "inherit",
    env: { ...process.env, PORT: "3000" },
  });

  try {
    await waitForServer("http://localhost:3000/api/health");
    console.log("Server is healthy! Launching Playwright browser suite...");

    const browser = await chromium.launch({ headless: true });
    
    // 1. Desktop Suite (1280x800)
    console.log("Running Desktop Browser Suite...");
    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const desktopPage = await desktopContext.newPage();

    fs.mkdirSync("docs/design/implementation/phase-2", { recursive: true });

    // Navigate to opportunity detail
    await desktopPage.goto("http://localhost:3000/opportunities/b2b-saas-audit-readiness-automation", {
      waitUntil: "networkidle",
    });

    await desktopPage.screenshot({
      path: "docs/design/implementation/phase-2/01_desktop_executive_decision_summary.png",
      fullPage: false,
    });
    console.log("Captured 01_desktop_executive_decision_summary.png");

    // Scroll to Cost-Benefit Economics & Toggle Scenarios
    const costSection = desktopPage.locator("#section-cost-benefit");
    await costSection.scrollIntoViewIfNeeded();
    await desktopPage.screenshot({
      path: "docs/design/implementation/phase-2/02_desktop_cost_benefit_economics.png",
    });
    console.log("Captured 02_desktop_cost_benefit_economics.png");

    // Toggle to UPSIDE scenario
    await desktopPage.click("button:has-text(UPSIDE)");
    await desktopPage.waitForTimeout(300);
    await desktopPage.screenshot({
      path: "docs/design/implementation/phase-2/03_desktop_upside_scenario_toggle.png",
    });
    console.log("Captured 03_desktop_upside_scenario_toggle.png");

    // Scroll to Risks & Assumptions and toggle tab
    const riskSection = desktopPage.locator("#section-risks-assumptions");
    await riskSection.scrollIntoViewIfNeeded();
    await desktopPage.screenshot({
      path: "docs/design/implementation/phase-2/04_desktop_risks_register.png",
    });
    console.log("Captured 04_desktop_risks_register.png");

    await desktopPage.click("button:has-text(Assumptions)");
    await desktopPage.waitForTimeout(300);
    await desktopPage.screenshot({
      path: "docs/design/implementation/phase-2/05_desktop_assumptions_matrix.png",
    });
    console.log("Captured 05_desktop_assumptions_matrix.png");

    // Scroll to Validation Roadmap
    const valSection = desktopPage.locator("#section-validation-roadmap");
    await valSection.scrollIntoViewIfNeeded();
    await desktopPage.screenshot({
      path: "docs/design/implementation/phase-2/06_desktop_validation_roadmap.png",
    });
    console.log("Captured 06_desktop_validation_roadmap.png");

    // 2. Mobile Browser Suite (390x844 iPhone 13)
    console.log("Running Mobile Browser Suite...");
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
    });
    const mobilePage = await mobileContext.newPage();

    await mobilePage.goto("http://localhost:3000/opportunities/b2b-saas-audit-readiness-automation", {
      waitUntil: "networkidle",
    });

    await mobilePage.screenshot({
      path: "docs/design/implementation/phase-2/07_mobile_decision_blueprint.png",
      fullPage: false,
    });
    console.log("Captured 07_mobile_decision_blueprint.png");

    const mobileCostSection = mobilePage.locator("#section-cost-benefit");
    await mobileCostSection.scrollIntoViewIfNeeded();
    await mobilePage.screenshot({
      path: "docs/design/implementation/phase-2/08_mobile_economics_scenarios.png",
    });
    console.log("Captured 08_mobile_economics_scenarios.png");

    await browser.close();
    console.log("All browser interactions completed with exit code 0.");
  } finally {
    console.log("Terminating web server cleanly...");
    server.kill("SIGTERM");
  }
}

run().catch((err) => {
  console.error("Browser verification failed:", err);
  process.exit(1);
});
