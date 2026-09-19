import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  prisma,
  resolveServerSession,
  checkAndIncrementRateLimit,
  hashRateLimitKey,
} from "@buildworth/database";
import {
  recordCommercialEvent,
  verifyInteractionToken,
  getPrivacyRetentionDTO,
} from "@buildworth/billing";
import { CommercialEventType, CommercialEventSource } from "@buildworth/shared";

// Strict allowlist of event types that web client is permitted to submit via generic API
const CLIENT_SUBMISSIBLE_EVENT_TYPES: Set<CommercialEventType> = new Set([
  "PAYWALL_VIEWED",
  "UPGRADE_CTA_CLICKED",
]);

// Strict allowlist of fixed UI locations
const ALLOWED_UI_LOCATIONS = new Set([
  "OPPORTUNITY_DOSSIER",
  "PRICING_PAGE",
  "SERVER_PAYWALL_BOUNDARY",
  "BLUEPRINT_SECTION",
]);

export async function POST(request: NextRequest) {
  try {
    // 1. Session Authentication (Derived on server only)
    const cookieStore = cookies();
    const sessionToken = cookieStore.get("buildworth_session")?.value;
    const sessionUser = sessionToken ? await resolveServerSession(prisma, sessionToken) : null;

    // 2. CSRF / Origin Verification
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin) {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return NextResponse.json(
          { error: "FORBIDDEN: Cross-site request rejected." },
          { status: 403 },
        );
      }
    }

    // 3. Rate Limiting (60 events per minute per IP / user)
    const identifier = sessionUser?.id || request.headers.get("x-forwarded-for") || "anon";
    const rateKey = hashRateLimitKey("commercial_event", identifier);
    const rateCheck = await checkAndIncrementRateLimit(prisma, rateKey, 60, 60);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "TOO_MANY_REQUESTS" },
        { status: 429, headers: { "Retry-After": String(rateCheck.retryAfterSeconds || 60) } },
      );
    }

    // 4. Request Body Validation
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "INVALID_JSON_BODY" }, { status: 400 });
    }

    // Reject prohibited client fields
    if (
      "deduplicationKey" in body ||
      "source" in body ||
      "opportunityId" in body ||
      "userId" in body ||
      "lawfulBasis" in body ||
      "purposeCode" in body ||
      "retentionClass" in body ||
      "retentionExpiresAt" in body
    ) {
      return NextResponse.json(
        { error: "INVALID_PAYLOAD: Client cannot supply internal event metadata, keys, or foreign relations." },
        { status: 400 },
      );
    }

    const {
      eventType,
      opportunitySlug,
      uiLocation,
      interactionToken,
      signedAnonymousConsentToken,
    } = body;

    if (!eventType || !CLIENT_SUBMISSIBLE_EVENT_TYPES.has(eventType)) {
      return NextResponse.json(
        { error: "INVALID_EVENT_TYPE: Event type is not permitted for client submission." },
        { status: 400 },
      );
    }

    if (!opportunitySlug || typeof opportunitySlug !== "string" || opportunitySlug.length > 128) {
      return NextResponse.json(
        { error: "INVALID_OPPORTUNITY_SLUG" },
        { status: 400 },
      );
    }

    if (!uiLocation || !ALLOWED_UI_LOCATIONS.has(uiLocation)) {
      return NextResponse.json(
        { error: "INVALID_UI_LOCATION: Must be an allowlisted UI location." },
        { status: 400 },
      );
    }

    // Verify completely-bound interaction token
    const interactionVerification = verifyInteractionToken(interactionToken, {
      eventType,
      opportunitySlug,
      uiLocation,
    });

    if (!interactionVerification.valid || !interactionVerification.interactionId) {
      return NextResponse.json(
        { error: `INVALID_INTERACTION_TOKEN: ${interactionVerification.error || "Token verification failed"}` },
        { status: 403 },
      );
    }

    // Resolve opportunityId from public slug
    const opp = await prisma.opportunity.findUnique({
      where: { slug: opportunitySlug },
      select: { id: true },
    });
    if (!opp) {
      return NextResponse.json({ error: "OPPORTUNITY_NOT_FOUND" }, { status: 404 });
    }

    // Derive server-authoritative source
    const serverSource: CommercialEventSource =
      eventType === "PAYWALL_VIEWED" ? "SERVER_PAYWALL_BOUNDARY" : "PRICING_PAGE";

    // Generate deduplicationKey from server-verified interaction ID and eventType
    const deduplicationKey = `pub_evt_${interactionVerification.interactionId}_${eventType}`;

    // 5. Record Commercial Event with Server-Authoritative Parameters
    const result = await recordCommercialEvent(prisma, {
      eventType,
      deduplicationKey,
      userId: sessionUser?.id || null,
      opportunityId: opp.id,
      source: serverSource,
      signedAnonymousConsentToken,
      metadata: {
        opportunitySlug,
        triggerLocation: uiLocation,
        userTier: sessionUser?.tier || "ANONYMOUS",
      },
    });

    return NextResponse.json({
      success: result.recorded,
      eventId: result.eventId,
      skippedConsent: result.skippedConsent,
    });
  } catch (err: any) {
    console.error("Commercial Event Route Error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal error recording event." },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json(getPrivacyRetentionDTO());
}
