import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    switches: [
      { subsystem: "AUTO_PUBLISH", isActive: true },
      { subsystem: "AI_GENERATION", isActive: false },
      { subsystem: "INGESTION", isActive: false },
      { subsystem: "ALL", isActive: false },
    ],
  });
}
