import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { providersFor } from "@/lib/providers/registry";
import { lyricsLookupSchema } from "@/lib/schemas";

const requestSchema = z.object({ title: z.string().optional(), artist: z.string().optional(), album: z.string().optional(), durationSeconds: z.number().positive().optional(), manualLyrics: z.string().max(12000).optional(), fixtureId: z.string().optional(), useFixture: z.boolean().default(false) });
export async function POST(request: Request) {
  try { const input = requestSchema.parse(await request.json()); return NextResponse.json(lyricsLookupSchema.parse(await providersFor(input.useFixture).lyrics.findLyrics(input))); }
  catch (error) { return apiError(error, "Lyrics lookup failed."); }
}
