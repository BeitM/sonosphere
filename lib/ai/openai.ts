import OpenAI from "openai";
import { z } from "zod";
import { songInterpretationSchema, spatialInterpretationSchema, worldPromptSchema, type GenerateRequest, type SongWorldAnalysis } from "@/lib/schemas";

export const aiEnabled = () => process.env.AI_MODE === "live" && Boolean(process.env.OPENAI_API_KEY);

async function structured<T>(name: string, schema: z.ZodType<T>, instructions: string, payload: unknown): Promise<T> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5-mini",
    instructions,
    input: JSON.stringify(payload),
    text: { format: { type: "json_schema", name, strict: true, schema: z.toJSONSchema(schema) } },
  });
  return schema.parse(JSON.parse(response.output_text));
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
      userGuidance: { personalInterpretation: request.personalInterpretation, emphasisNote: request.emphasisNote, refinement: request.refinement },
    };
    const interpretation = await structured("song_interpretation", songInterpretationSchema,
      "Interpret a song from weighted evidence. Attribute claims, keep fan readings uncertain, never reveal chain-of-thought, never quote copyrighted lyrics, and preserve uncertainty when evidence is weak. Return only the strict schema.", evidence);
    const spatialInterpretation = await structured("spatial_interpretation", spatialInterpretationSchema,
      "Translate the supplied semantic interpretation and musical structure into one coherent navigable spatial metaphor. Use accessibility, distance, scale, material, openness, and persistent landmarks. Avoid music-video imitation and living-artist style references. Return only the strict schema.", { interpretation, music: base.music, refinement: request.refinement });
    const worldPrompt = await structured("world_prompt", worldPromptSchema,
      "Write a concrete prompt for a static, explorable 3D base environment. Require connected areas, navigable paths, multiple viewpoints, foreground/midground/background, spatial continuity, persistent landmarks, and consistent architecture. Do not include lyrics, camera-shot framing, trademarked worlds, recognizable people, or timed animation. Preserve the supplied confidence and evidence weights exactly. Return only the strict schema.", { interpretation, spatialInterpretation, music: base.music, confidence: base.confidence, evidenceWeights: base.weights });
    return { ...base, interpretation, spatialInterpretation, worldPrompt };
  } catch (error) {
    console.error("Structured AI generation failed; returning validated local fallback.", error instanceof Error ? error.message : "Unknown error");
    return { ...base, worldPrompt: { ...base.worldPrompt, limitations: [...base.worldPrompt.limitations, "Live AI generation failed validation, so a validated local fallback was used."] } };
  }
}
