import { NextResponse } from "next/server";
import { z } from "zod";

export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
export const AUDIO_TYPES = new Set(["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/mp4", "audio/x-m4a", "audio/flac", "audio/x-flac"]);
export const AUDIO_EXTENSIONS = [".mp3", ".wav", ".m4a", ".flac"];

export function validateAudio(file: File | null): string | null {
  if (!file) return "Choose an audio file before continuing.";
  const extensionAllowed = AUDIO_EXTENSIONS.some((extension) => file.name.toLowerCase().endsWith(extension));
  if (!AUDIO_TYPES.has(file.type) && !extensionAllowed) return "Unsupported audio format. Use MP3, WAV, M4A, or FLAC.";
  if (file.size <= 0) return "The selected file is empty or unreadable.";
  if (file.size > MAX_AUDIO_BYTES) return "Audio files must be 25 MB or smaller in this prototype.";
  return null;
}

export function apiError(error: unknown, fallback = "The request could not be completed.") {
  if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid request", issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) }, { status: 400 });
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message || fallback }, { status: 500 });
}
