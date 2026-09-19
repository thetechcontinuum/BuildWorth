#!/bin/bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT="docs/design/implementation/admin-mvp"
mkdir -p "$OUT"

# List of authenticated paths to capture
PAGES=(
  "/users:03-users-list.png"
  "/sources:04-sources-management.png"
  "/ingestion:05-ingestion-operations.png"
  "/drafts:06-drafts-portal.png"
  "/review-queue:07-review-queue.png"
  "/problem-clusters:08-problem-clusters.png"
  "/stats:09-basic-statistics.png"
  "/ai-spend:10-ai-spend.png"
  "/kill-switches:11-kill-switches.png"
  "/evaluation:12-evaluation-metrics.png"
  "/audit-logs:13-audit-logs.png"
)

for item in "${PAGES[@]}"; do
  path="${item%%:*}"
  file="${item##*:}"
  url="http://localhost:3001/api/auth/dev-preview-cookie?redirect=${path}"
  target="$OUT/$file"
  
  echo "[$(date +%H:%M:%S)] Capturing $path -> $file ..."
  
  # Run Chrome with 8-second timeout per page and isolated temporary profile
  TPROFILE="/tmp/chrome_p_$$"
  mkdir -p "$TPROFILE"
  
  python3 -c '
import subprocess, sys, time, os, signal

chrome = sys.argv[1]
url = sys.argv[2]
target = sys.argv[3]
profile = sys.argv[4]

cmd = [
    chrome,
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    f"--user-data-dir={profile}",
    "--window-size=1280,900",
    f"--screenshot={target}",
    url
]

p = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    p.wait(timeout=8)
    if os.path.exists(target) and os.path.getsize(target) > 1000:
        print(f"SUCCESS: {target} ({os.path.getsize(target)} bytes)")
    else:
        print(f"FAILED: file empty or not created for {url}")
except subprocess.TimeoutExpired:
    print(f"TIMEOUT (8s) on {url}, killing process...")
    p.kill()
    p.wait()
' "$CHROME" "$url" "$target" "$TPROFILE"

  rm -rf "$TPROFILE"
done

echo "Finished capture pass."
ls -lh "$OUT"
