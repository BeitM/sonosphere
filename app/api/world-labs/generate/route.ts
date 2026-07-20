import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireGenerationAccess, startWorldGeneration, WorldLabsRequestError } from "@/lib/worldlabs/client";
import { worldLabsGenerateRequestSchema } from "@/lib/worldlabs/schemas";

export async function POST(request: Request) {
  try {
    requireGenerationAccess(request);
    const input = worldLabsGenerateRequestSchema.parse(await request.json());
    return NextResponse.json(await startWorldGeneration({ prompt: input.prompt, displayName: input.displayName, model: input.model, referenceImages: input.referenceImages }));
  } catch (error) {
    if (error instanceof WorldLabsRequestError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof ZodError) return NextResponse.json({ error: "Invalid World Labs generation request.", issues: error.issues }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "World generation could not be started." }, { status: 500 });
  }
}
