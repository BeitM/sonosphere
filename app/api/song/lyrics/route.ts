import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { providers } from "@/lib/providers/mock";
import { lyricsLookupSchema } from "@/lib/schemas";

const requestSchema = z.object({ title: z.string().optional(), artist: z.string().optional(), manualLyrics: z.string().max(12000).optional(), fixtureId: z.string().optional() });
export async function POST(request: Request) {
  try { return NextResponse.json(lyricsLookupSchema.parse(await providers.lyrics.findLyrics(requestSchema.parse(await request.json())))); }
  catch (error) { return apiError(error, "Lyrics lookup failed."); }
}
