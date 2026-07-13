import { NextResponse } from "next/server";
import { providers } from "@/lib/providers/mock";
import { apiError, validateAudio } from "@/lib/api";
import { songIdentificationSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const data = await request.formData();
    const file = data.get("audio") instanceof File ? data.get("audio") as File : null;
    const error = validateAudio(file);
    if (error || !file) return NextResponse.json({ error }, { status: 400 });
    const result = await providers.recognition.identifySong({
      audio: { name: file.name, type: file.type, size: file.size },
      manualTitle: String(data.get("title") || ""), manualArtist: String(data.get("artist") || ""), fixtureId: String(data.get("fixtureId") || "known"),
    });
    return NextResponse.json(songIdentificationSchema.parse(result));
  } catch (error) { return apiError(error, "Song identification failed."); }
}
