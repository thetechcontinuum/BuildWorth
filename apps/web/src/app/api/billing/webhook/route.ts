import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@buildworth/database";
import { getStripeClient, getBillingConfig, processStripeWebhookEvent } from "@buildworth/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json({ error: "MISSING_STRIPE_SIGNATURE" }, { status: 400 });
    }

    const config = getBillingConfig();
    const stripe = getStripeClient();

    // Read exact raw Buffer from request body
    const rawBodyBuffer = Buffer.from(await request.arrayBuffer());

    const result = await processStripeWebhookEvent(
      prisma,
      stripe,
      rawBodyBuffer,
      signature,
      config.stripeWebhookSecret
    );

    return NextResponse.json({
      received: true,
      eventId: result.eventId,
      eventType: result.eventType,
      status: result.processingStatus,
    });
  } catch (err: any) {
    console.error("Webhook processing failed:", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "Webhook processing failure." },
      { status: 400 }
    );
  }
}
