import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    dailySpendCents: 142,
    dailyLimitCents: 500,
    monthlySpendCents: 3218,
    monthlyLimitCents: 15000,
  });
}
