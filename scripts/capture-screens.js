const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUTPUT_DIR = path.resolve(__dirname, "../docs/design/implementation/admin-mvp");

const pages = [
  { path: "/", filename: "02-dashboard.png" },
  { path: "/users", filename: "03-users-list.png" },
  { path: "/sources", filename: "04-sources-management.png" },
  { path: "/ingestion", filename: "05-ingestion-operations.png" },
  { path: "/drafts", filename: "06-drafts-portal.png" },
  { path: "/review-queue", filename: "07-review-queue.png" },
  { path: "/problem-clusters", filename: "08-problem-clusters.png" },
  { path: "/stats", filename: "09-basic-statistics.png" },
  { path: "/ai-spend", filename: "10-ai-spend.png" },
  { path: "/kill-switches", filename: "11-kill-switches.png" },
  { path: "/evaluation", filename: "12-evaluation-metrics.png" },
  { path: "/audit-logs", filename: "13-audit-logs.png" },
];

async function captureScreens() {
  const tmpProfile = `/tmp/chrome_admin_mvp_${Date.now()}`;
  fs.mkdirSync(tmpProfile, { recursive: true });

  // First prime the profile with cookie by opening a page that sets it or passing cookie directly
  // In Chromium, we can launch headless with default cookies in SQLite or launch with remote debugging
  // Or simpler: Next.js reads cookies from request. In our admin-page-guard and layout:
  // We supported `admin_session=dev-admin-preview-session-token-2026`.
  // What if we pass query parameter or header?
  // Let's check: Chrome headless CLI allows `--cookie` or user-data-dir!
}
