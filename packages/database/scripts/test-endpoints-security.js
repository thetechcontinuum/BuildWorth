async function runEndpointsSecurity() {
  console.log("=== Testing API Non-Admin Rejection & CSRF Defenses ===");

  const baseUrl = "http://localhost:3001";

  // 1. Invite endpoint without session
  console.log("Test 1: POST /api/admin/users/invite rejects unauthenticated caller");
  const unauthInvite = await fetch(`${baseUrl}/api/admin/users/invite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Action": "1",
      Origin: baseUrl,
    },
    body: JSON.stringify({ email: "unauth@test.com" }),
  });
  if (unauthInvite.status !== 401) {
    throw new Error(`Test 1 failed: Expected 401, got ${unauthInvite.status}`);
  }
  console.log("  ✓ Test 1 Passed (Unauthenticated caller rejected with 401)");

  // 2. Role endpoint without session
  console.log("Test 2: POST /api/admin/users/[id]/role rejects unauthenticated caller");
  const unauthRole = await fetch(`${baseUrl}/api/admin/users/dummy-id/role`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Action": "1",
      Origin: baseUrl,
    },
    body: JSON.stringify({ role: "ADMIN" }),
  });
  if (unauthRole.status !== 401) {
    throw new Error(`Test 2 failed: Expected 401, got ${unauthRole.status}`);
  }
  console.log("  ✓ Test 2 Passed (Unauthenticated caller rejected with 401)");

  // 3. CSRF: Missing X-Admin-Action header
  console.log("Test 3: POST /api/admin/users/invite rejects missing X-Admin-Action header");
  const noHeaderInvite = await fetch(`${baseUrl}/api/admin/users/invite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: baseUrl,
      Cookie: "admin_session=dev-admin-preview-session-token-2026",
    },
    body: JSON.stringify({ email: "csrf@test.com" }),
  });
  if (noHeaderInvite.status !== 403) {
    throw new Error(`Test 3 failed: Expected 403 for missing action header, got ${noHeaderInvite.status}`);
  }
  console.log("  ✓ Test 3 Passed (Missing X-Admin-Action rejected with 403)");

  // 4. CSRF: Cross-origin / malicious Origin header
  console.log("Test 4: POST /api/admin/users/invite rejects cross-origin request");
  const crossOriginInvite = await fetch(`${baseUrl}/api/admin/users/invite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Action": "1",
      Origin: "https://evil-attacker.com",
      Cookie: "admin_session=dev-admin-preview-session-token-2026",
    },
    body: JSON.stringify({ email: "csrf@test.com" }),
  });
  if (crossOriginInvite.status !== 403) {
    throw new Error(`Test 4 failed: Expected 403 for cross-origin, got ${crossOriginInvite.status}`);
  }
  console.log("  ✓ Test 4 Passed (Cross-origin mutation rejected with 403)");

  // 5. CSRF on Role endpoint
  console.log("Test 5: POST /api/admin/users/[id]/role rejects cross-origin request");
  const crossOriginRole = await fetch(`${baseUrl}/api/admin/users/dummy-id/role`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Action": "1",
      Origin: "https://evil-attacker.com",
      Cookie: "admin_session=dev-admin-preview-session-token-2026",
    },
    body: JSON.stringify({ role: "ADMIN" }),
  });
  if (crossOriginRole.status !== 403) {
    throw new Error(`Test 5 failed: Expected 403 for cross-origin, got ${crossOriginRole.status}`);
  }
  console.log("  ✓ Test 5 Passed (Cross-origin role mutation rejected with 403)");

  console.log("\nAll Endpoint Security & CSRF Tests PASSED! (5/5)");
}

runEndpointsSecurity().catch((err) => {
  console.error("FATAL TEST FAILURE:", err);
  process.exit(1);
});
