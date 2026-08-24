import { NextRequest, NextResponse } from "next/server";
import { getAllStoredOpportunities, addStoredOpportunity, StoredOpportunity } from "@/lib/opportunity-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const opps = getAllStoredOpportunities();
  return NextResponse.json({
    success: true,
    totalCount: opps.length,
    opportunities: opps
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as StoredOpportunity;
    if (!body.title || !body.slug) {
      return NextResponse.json({ error: "Invalid opportunity payload" }, { status: 400 });
    }
    addStoredOpportunity(body);
    return NextResponse.json({ success: true, opportunity: body });
  } catch {
    return NextResponse.json({ error: "Failed to add opportunity" }, { status: 500 });
  }
}
