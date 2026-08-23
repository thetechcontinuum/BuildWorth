import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    app: "buildworth-web",
    timestamp: new Date().toISOString(),
  });
}
