import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { generateRequestSchema } from "@/lib/schemas";
import { runAnalysis } from "@/lib/analysis/pipeline";

export async function POST(request: Request) {
  try { const result = await runAnalysis(generateRequestSchema.parse(await request.json())); return NextResponse.json({ interpretation: result.interpretation, confidence: result.confidence, evidenceWeights: result.weights, fallbackLevel: result.fallbackLevel }); }
  catch (error) { return apiError(error, "Song interpretation failed."); }
}
