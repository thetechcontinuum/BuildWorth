import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession, NO_CACHE_HEADERS } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.authorized) {
    return auth.response;
  }

  return NextResponse.json(
    {
      status: "ok",
      sampleEvaluated: 100,
      unsupportedClaimRatePercent: 0.8,
      buyerDefinitionQualityPercent: 97.2,
      scoreCalibrationAvgError: 3.2,
      isAutoPublishPermitted: false,
    },
    { headers: NO_CACHE_HEADERS },
  );
}
