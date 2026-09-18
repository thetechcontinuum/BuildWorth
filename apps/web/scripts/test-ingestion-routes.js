const assert = require("assert");

async function runRouteTests() {
  console.log("=== Testing Protected Staging Ingestion Endpoints ===");

  // Set test environment variables
  process.env.CRON_SECRET = "staging_cron_secret_test_12345";
  process.env.NODE_ENV = "test";
  delete process.env.VERCEL_ENV;
  delete process.env.BUILDWORTH_ENV;

  const { POST } = await import("../src/app/api/internal/ingestion/run/route.ts");
  const { GET } = await import("../src/app/api/internal/ingestion/run/[runId]/route.ts");

  const { NextRequest } = await import("next/server");

  // 1. Missing Authorization Header
  {
    const req = new NextRequest("http://localhost:3000/api/internal/ingestion/run", {
      method: "POST",
      headers: { "idempotency-key": "test-key-12345678" },
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 401, "Should return 401 for missing auth");
    const json = await res.json();
    assert.strictEqual(json.error, "Unauthorized");
    assert.strictEqual(res.headers.get("cache-control"), "private, no-store, max-age=0, must-revalidate");
    console.log("✓ 1. Rejects missing authorization with 401 and no-cache header");
  }

  // 2. Invalid Bearer Token
  {
    const req = new NextRequest("http://localhost:3000/api/internal/ingestion/run", {
      method: "POST",
      headers: {
        authorization: "Bearer invalid_secret_token",
        "idempotency-key": "test-key-12345678",
      },
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 401, "Should return 401 for invalid bearer token");
    console.log("✓ 2. Rejects invalid authorization token with 401");
  }

  // 3. Secrets in Query Parameters Forbidden
  {
    const req = new NextRequest("http://localhost:3000/api/internal/ingestion/run?secret=staging_cron_secret_test_12345", {
      method: "POST",
      headers: {
        authorization: "Bearer staging_cron_secret_test_12345",
        "idempotency-key": "test-key-12345678",
      },
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 401, "Should reject requests passing secrets in query parameters");
    console.log("✓ 3. Forbids secrets in query parameters");
  }

  // 4. Production Environment Rejection (403)
  {
    process.env.VERCEL_ENV = "production";
    const req = new NextRequest("http://localhost:3000/api/internal/ingestion/run", {
      method: "POST",
      headers: {
        authorization: "Bearer staging_cron_secret_test_12345",
        "idempotency-key": "test-key-12345678",
      },
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 403, "Should return 403 in production environment");
    const json = await res.json();
    assert.ok(json.error.includes("forbidden in production"));
    console.log("✓ 4. Rejects execution in production environment with 403");
    delete process.env.VERCEL_ENV;
  }

  // 5. Missing or Malformed Idempotency-Key Header (400)
  {
    const req1 = new NextRequest("http://localhost:3000/api/internal/ingestion/run", {
      method: "POST",
      headers: {
        authorization: "Bearer staging_cron_secret_test_12345",
      },
    });
    const res1 = await POST(req1);
    assert.strictEqual(res1.status, 400, "Should return 400 for missing Idempotency-Key");

    const req2 = new NextRequest("http://localhost:3000/api/internal/ingestion/run", {
      method: "POST",
      headers: {
        authorization: "Bearer staging_cron_secret_test_12345",
        "idempotency-key": "bad key with spaces!",
      },
    });
    const res2 = await POST(req2);
    assert.strictEqual(res2.status, 400, "Should return 400 for malformed Idempotency-Key");
    console.log("✓ 5. Rejects missing or malformed Idempotency-Key with 400");
  }

  // 6. GET Endpoint Security & 404
  {
    const reqUnauthorized = new NextRequest("http://localhost:3000/api/internal/ingestion/run/run-not-found-123", {
      method: "GET",
    });
    const resUnauth = await GET(reqUnauthorized, { params: { runId: "run-not-found-123" } });
    assert.strictEqual(resUnauth.status, 401, "GET endpoint requires authorization");

    const reqValid = new NextRequest("http://localhost:3000/api/internal/ingestion/run/run-not-found-123", {
      method: "GET",
      headers: {
        authorization: "Bearer staging_cron_secret_test_12345",
      },
    });
    const resValid = await GET(reqValid, { params: { runId: "run-not-found-123" } });
    assert.strictEqual(resValid.status, 404, "GET non-existent run returns 404");
    console.log("✓ 6. Verified GET status endpoint auth and 404 handling");
  }

  console.log("\n=== All Protected Route Security Tests PASSED ===");
}

runRouteTests().catch((err) => {
  console.error("Route test failure:", err);
  process.exit(1);
});
