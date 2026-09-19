const http = require("http");

async function runRealLoginFlowTest() {
  console.log("=== Testing Real Admin Login Flow on localhost:3001 ===");

  const adminEmail = "admin@buildworth.io";

  // Step 1: Admin email submission
  console.log("Step 1: Admin email submission to POST /api/auth/login");
  const loginRes = await fetch("http://127.0.0.1:3001/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: adminEmail }),
  });
  const loginJson = await loginRes.json();
  console.log("  HTTP Status:", loginRes.status);
  console.log("  Response Body:", JSON.stringify(loginJson));
  if (loginRes.status !== 200 || !loginJson.success || !loginJson.testToken) {
    throw new Error("Failed step 1: Did not receive verification testToken");
  }

  const rawToken = loginJson.testToken;
  console.log("  ✓ Verification token successfully issued:", rawToken.slice(0, 10) + "...");

  // Step 2: Verification token submission to POST /api/auth/verify
  console.log("Step 2: Token verification at POST /api/auth/verify");
  const verifyRes = await fetch("http://127.0.0.1:3001/api/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: rawToken, email: adminEmail }),
  });
  const verifyJson = await verifyRes.json();
  console.log("  HTTP Status:", verifyRes.status);
  console.log("  Response Body:", JSON.stringify(verifyJson));
  const setCookieHeader = verifyRes.headers.get("set-cookie") || "";
  console.log("  Set-Cookie Header:", setCookieHeader);
  if (verifyRes.status !== 200 || !verifyJson.success || !setCookieHeader.includes("admin_session=")) {
    throw new Error("Failed step 2: Did not receive admin_session cookie");
  }

  const adminCookie = setCookieHeader.split(";")[0];
  console.log("  ✓ admin_session successfully established:", adminCookie.slice(0, 25) + "...");

  // Step 3: Access protected pages using newly established admin_session cookie
  console.log("Step 3: Access protected pages with real admin session");
  const pages = ["/users", "/sources", "/kill-switches", "/audit-logs"];
  for (const page of pages) {
    const pageRes = await fetch(`http://127.0.0.1:3001${page}`, {
      headers: { Cookie: adminCookie },
    });
    console.log(`  GET ${page} -> Status: ${pageRes.status}`);
    if (pageRes.status !== 200) {
      throw new Error(`Failed step 3: Page ${page} returned status ${pageRes.status}`);
    }
  }
  console.log("  ✓ All protected pages returned 200 OK with real session");

  // Step 4: Logout and session revocation
  console.log("Step 4: Logout via POST /api/auth/logout");
  const logoutRes = await fetch("http://127.0.0.1:3001/api/auth/logout", {
    method: "POST",
    headers: { Cookie: adminCookie },
  });
  console.log("  HTTP Status:", logoutRes.status);
  const logoutCookieHeader = logoutRes.headers.get("set-cookie") || "";
  console.log("  Logout Set-Cookie:", logoutCookieHeader);
  if (logoutRes.status !== 200 || !logoutCookieHeader.includes("admin_session=;")) {
    throw new Error("Failed step 4: admin_session was not cleared");
  }
  console.log("  ✓ admin_session cleared on logout");

  // Step 5: Verify access is rejected after logout
  console.log("Step 5: Verify protected page rejects cleared session");
  const postLogoutRes = await fetch("http://127.0.0.1:3001/users", {
    headers: { Cookie: "admin_session=" },
    redirect: "manual",
  });
  console.log("  GET /users after logout -> Status:", postLogoutRes.status, "Location:", postLogoutRes.headers.get("location"));
  if (postLogoutRes.status !== 307 || !postLogoutRes.headers.get("location")?.includes("/login")) {
    throw new Error("Failed step 5: Protected page was not redirected to /login after logout");
  }
  console.log("  ✓ Protected page redirected to /login");

  // Step 6: Confirm /api/auth/dev-preview-cookie gating
  console.log("Step 6: Confirm /api/auth/dev-preview-cookie is strictly rejected in non-localhost or when disabled");
  
  // Test A: Non-localhost Host header via Node http
  const testPreviewHost = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "127.0.0.1",
      port: 3001,
      path: "/api/auth/dev-preview-cookie",
      method: "GET",
      headers: { "Host": "admin-preview.buildworth.io" }
    }, (res) => {
      resolve(res.statusCode);
    });
    req.on("error", reject);
    req.end();
  });
  console.log("  GET with Host: admin-preview.buildworth.io -> Status:", testPreviewHost);
  if (testPreviewHost !== 404) {
    throw new Error(`Expected 404 for preview Host, got ${testPreviewHost}`);
  }

  // Test B: Non-localhost x-forwarded-host
  const testForwardedHost = await fetch("http://127.0.0.1:3001/api/auth/dev-preview-cookie", {
    headers: { "x-forwarded-host": "production.buildworth.io" }
  });
  console.log("  GET with x-forwarded-host: production.buildworth.io -> Status:", testForwardedHost.status);
  if (testForwardedHost.status !== 404) {
    throw new Error(`Expected 404 for production forwarded host, got ${testForwardedHost.status}`);
  }
  console.log("  ✓ Route returned 404 for non-localhost Host / forwarded host");

  console.log("\nReal Admin Login Flow & Route Gating Verified! (6/6 steps passed)");
}

runRealLoginFlowTest().catch((e) => {
  console.error("TEST FAILURE:", e);
  process.exit(1);
});
