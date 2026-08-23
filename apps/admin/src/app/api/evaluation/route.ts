import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    sampleEvaluated: 100,
    unsupportedClaimRatePercent: 0.8,
    buyerDefinitionQualityPercent: 97.2,
    scoreCalibrationAvgError: 3.2,
    isAutoPublishPermitted: true,
  });
}
