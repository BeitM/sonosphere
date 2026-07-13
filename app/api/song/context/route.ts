import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { providers } from "@/lib/providers/mock";
import { songContextSchema } from "@/lib/schemas";

const requestSchema = z.object({ title: z.string().optional(), artist: z.string().optional(), manualContext: z.string().max(4000).optional(), fixtureId: z.string().optional() });
export async function POST(request: Request) {
  try { return NextResponse.json(songContextSchema.parse(await providers.context.research(requestSchema.parse(await request.json())))); }
  catch (error) { return apiError(error, "Context research failed."); }
}
