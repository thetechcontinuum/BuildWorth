import { NextResponse } from "next/server";

export async function GET() {
  const sources = [
    { sourceKey: "hackernews", name: "Hacker News", status: "HEALTHY", rateLimit: 120 },
    { sourceKey: "reddit", name: "Reddit Tech & Ops", status: "HEALTHY", rateLimit: 60 },
    { sourceKey: "github", name: "GitHub Issues", status: "HEALTHY", rateLimit: 80 },
    { sourceKey: "producthunt", name: "Product Hunt", status: "HEALTHY", rateLimit: 60 },
  ];
  return NextResponse.json({ status: "ok", sources });
}
