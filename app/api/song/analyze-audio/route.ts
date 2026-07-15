import { NextResponse } from "next/server";
import { apiError, validateAudio } from "@/lib/api";
import { providersFor } from "@/lib/providers/registry";
import { musicalAnalysisSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const data = await request.formData();
    const file = data.get("audio") instanceof File ? data.get("audio") as File : null;
    const error = validateAudio(file);
    if (error || !file) return NextResponse.json({ error }, { status: 400 });
    const providers = providersFor(data.get("useFixture") === "true");
    const result = await providers.music.analyze({ audio: { name: file.name, type: file.type, size: file.size, bytes: await file.arrayBuffer() }, fixtureId: String(data.get("fixtureId") || "known") });
    return NextResponse.json(musicalAnalysisSchema.parse(result));
  } catch (error) { return apiError(error, "Audio analysis failed."); }
}
