import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { songInterpretationSchema, spatialInterpretationSchema, worldPromptSchema, type GenerateRequest, type SongWorldAnalysis } from "@/lib/schemas";

export const aiEnabled = () => process.env.AI_MODE === "live" && Boolean(process.env.OPENAI_API_KEY);

async function structured<T>(name: string, schema: z.ZodType<T>, instructions: string, payload: unknown): Promise<T> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.parse({
    model: process.env.OPENAI_MODEL || "gpt-5.6-terra",
    reasoning: { effort: "low" },
    instructions,
    input: JSON.stringify(payload),
    store: false,
    text: { format: zodTextFormat(schema, name) },
  });
  if (!response.output_parsed) throw new Error(`OpenAI returned no parsed ${name} output.`);
  return schema.parse(response.output_parsed);
}

export async function enhanceWithOpenAI(base: SongWorldAnalysis, request: GenerateRequest): Promise<SongWorldAnalysis> {
  if (!aiEnabled()) return base;
  try {
    const evidence = {
      song: base.song,
      lyrics: base.lyrics.available ? { text: base.lyrics.lyrics, sourceKind: base.lyrics.sourceKind, confidence: base.lyrics.confidence } : { available: false },
      context: base.context,
      music: base.music,
      evidenceWeights: base.weights,
      confidence: base.confidence,
      userGuidance: { personalInterpretation: request.personalInterpretation, visualPreference: request.visualPreference, emphasisNote: request.emphasisNote, refinement: request.refinement },
    };
    const interpretation = await structured("song_interpretation", songInterpretationSchema,
      "Create a grounded song interpretation from the supplied weighted evidence. Success means every claim reflects available music, lyrics, context, or user guidance; uncertain creator intent stays explicitly uncertain; copyrighted lyrics are never quoted; and the result matches the strict schema.", evidence);
    const spatialInterpretation = await structured("spatial_interpretation", spatialInterpretationSchema,
      "Translate the supplied interpretation and musical structure into one coherent navigable spatial metaphor. Success means detected sections have connected spatial counterparts, accessibility and scale express the emotional arc, landmarks preserve orientation, and the result avoids music-video imitation and living-artist style references. Return only the strict schema.", { interpretation, music: base.music, refinement: request.refinement });
    const worldPrompt = await structured("world_prompt", worldPromptSchema,
      "Write a concrete prompt for a static, explorable 3D base environment. Success means the world has connected areas, navigable paths, multiple viewpoints, readable depth, spatial continuity, persistent landmarks, and consistent architecture. Exclude lyrics, camera-shot framing, trademarked worlds, recognizable people, and timed animation. Preserve confidence and evidence weights exactly. Return only the strict schema.", { interpretation, spatialInterpretation, music: base.music, confidence: base.confidence, evidenceWeights: base.weights });
    return { ...base, interpretation, spatialInterpretation, worldPrompt };
  } catch (error) {
    console.error("Structured AI generation failed; returning validated local fallback.", error instanceof Error ? error.message : "Unknown error");
    return { ...base, worldPrompt: { ...base.worldPrompt, limitations: [...base.worldPrompt.limitations, "Live AI generation failed validation, so a validated local fallback was used."] } };
  }
}
