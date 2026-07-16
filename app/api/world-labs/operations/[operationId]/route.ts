import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorldGeneration, requireGenerationAccess, WorldLabsRequestError } from "@/lib/worldlabs/client";

const operationIdSchema = z.string().uuid();

export async function GET(request: Request, context: { params: Promise<{ operationId: string }> }) {
  try {
    requireGenerationAccess(request);
    const operationId = operationIdSchema.parse((await context.params).operationId);
    return NextResponse.json(await getWorldGeneration(operationId));
  } catch (error) {
    if (error instanceof WorldLabsRequestError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid World Labs operation ID." }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "World generation status could not be loaded." }, { status: 500 });
  }
}
