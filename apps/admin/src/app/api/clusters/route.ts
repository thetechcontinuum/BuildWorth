import { NextResponse } from "next/server";

export async function GET() {
  const clusters = [
    {
      id: "cluster-1",
      title: "Automated SOC2 Git Evidence Collector",
      signalCount: 28,
      vertical: "DevOps",
    },
    {
      id: "cluster-2",
      title: "Snowflake Runaway Query Circuit Breaker",
      signalCount: 42,
      vertical: "FinOps",
    },
  ];
  return NextResponse.json({ status: "ok", clusters });
}
