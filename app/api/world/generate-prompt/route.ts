import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { generateRequestSchema } from "@/lib/schemas";
import { runAnalysis } from "@/lib/analysis/pipeline";

export async function POST(request: Request) {
  try { return NextResponse.json(await runAnalysis(generateRequestSchema.parse(await request.json()))); }
  catch (error) { return apiError(error, "World prompt generation failed."); }
}
