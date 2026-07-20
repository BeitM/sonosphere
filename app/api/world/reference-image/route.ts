import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { generateReferencePanorama, referenceImageRequestSchema, ReferenceImageGenerationError } from "@/lib/reference-images";
import { requireGenerationAccess, WorldLabsRequestError } from "@/lib/worldlabs/client";

export async function POST(request: Request) {
  try {
    requireGenerationAccess(request);
    const input = referenceImageRequestSchema.parse(await request.json());
    return NextResponse.json(await generateReferencePanorama(input.prompt));
  } catch (error) {
    if (error instanceof ReferenceImageGenerationError || error instanceof WorldLabsRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ZodError) return NextResponse.json({ error: "Invalid reference-image request.", issues: error.issues }, { status: 400 });
    return NextResponse.json({ error: "The visual reference could not be generated." }, { status: 500 });
  }
}
