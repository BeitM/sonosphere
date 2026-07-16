import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { songInterpretationSchema, spatialInterpretationSchema, worldPromptSchema, type GenerateRequest, type SongWorldAnalysis } from "@/lib/schemas";
import { buildMarblePrompt, normalizeWorldPrompt } from "@/lib/analysis/world-prompts";

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
    const refinementContract = {
      balance: `${request.refinement.balance} controls evidence emphasis and must materially affect the concept without inventing evidence.`,
      realism: `${request.refinement.realism} controls physical plausibility and representation style.`,
      scale: `${request.refinement.scale} is a hard geometric constraint for the entire environment; it must not select an architectural style.`,
      intensity: `${request.refinement.intensity} controls emotional pressure through light, exposure, enclosure, repetition, distance, and material contrast; it must never override scale.`,
      worldType: request.refinement.worldType === "auto" ? "Choose from song-specific evidence." : `${request.refinement.worldType} is required.`,
    };
    const evidence = {
      song: base.song,
      lyrics: base.lyrics.available ? { text: base.lyrics.lyrics, sourceKind: base.lyrics.sourceKind, confidence: base.lyrics.confidence } : { available: false },
      context: base.context,
      music: base.music,
      evidenceWeights: base.weights,
      confidence: base.confidence,
      userGuidance: { personalInterpretation: request.personalInterpretation, visualPreference: request.visualPreference, emphasisNote: request.emphasisNote, refinement: request.refinement, refinementContract },
    };
    const interpretation = await structured("song_interpretation", songInterpretationSchema,
      "Create a grounded, song-specific interpretation from the supplied weighted evidence. Analyze the lyrics semantically without quoting them and connect their imagery, narrative perspective, and emotional conflicts to measured musical changes. When the confirmed title and artist identify a well-known song, you may add stable, widely established common interpretations from model knowledge as common_interpretation or ai_inference evidence, but clearly distinguish those readings from documented artist intent and never invent statements, quotations, or facts. Acoustic regions are unsupervised changes in timbre and energy, not verified verse or chorus labels. Success means uncertainty stays explicit and the result matches the strict schema.", evidence);
    const spatialInterpretation = await structured("spatial_interpretation", spatialInterpretationSchema,
      "Translate the supplied interpretation and musical structure into one coherent navigable spatial metaphor. Treat the selected scale as a hard geometric constraint across every area. Emotional intensity must be expressed through light, exposure, enclosure, repetition, distance, and material contrast without changing scale. Scale must never determine architectural style; select material and architectural language from this song's evidence and explicit visual guidance. Choose the topology—linear, looping, branching, radial, layered, or distributed—from the song's measured and interpreted relationships. The areas array describes connected places within that topology, not mandatory chronological beats. Do not assume a start-development-climax-ending arc, a single dominant destination, or that the most intense region must be largest, tallest, most open, or last. Explain the song-specific transformation logic and orientation strategy. Avoid music-video imitation and living-artist style references. Return only the strict schema.", { interpretation, music: base.music, refinement: request.refinement, refinementContract, visualPreference: request.visualPreference });
    const worldPrompt = await structured("world_prompt", worldPromptSchema,
      "Return two complementary prompt forms in the strict schema. The prompt field is the complete creative world plan and may describe the full musical journey. The marblePrompt field targets World Labs Marble 1.1/1.1 Plus: it must be no more than 1,800 characters, contain no repeated passage, and describe exactly one primary explorable area rather than connected named zones or a multi-stage game level. Express the selected topology only through internal paths, sightlines, thresholds, and viewpoints inside that one location. Put the location, hard scale constraint, navigation, and one orientation landmark first. Include essential exclusions within marblePrompt rather than relying only on negativePrompt. Preserve the selected scale everywhere; intensity must not override it or imply an architectural style. Both prompts must be static, explorable, navigable, spatially coherent, song-specific, and free of lyrics, camera-shot framing, trademarked worlds, recognizable people, and timed animation. Preserve confidence and evidence weights exactly. Return only the strict schema.", { interpretation, spatialInterpretation, music: base.music, refinement: request.refinement, refinementContract, confidence: base.confidence, evidenceWeights: base.weights });
    const normalizedWorldPrompt = normalizeWorldPrompt({
      ...worldPrompt,
      marblePrompt: buildMarblePrompt(request.refinement, interpretation, spatialInterpretation),
      limitations: worldPrompt.limitations.filter((item) => !item.includes("Live AI generation failed")),
    }, spatialInterpretation.journey.topology);
    return { ...base, interpretation, spatialInterpretation, worldPrompt: normalizedWorldPrompt };
  } catch (error) {
    console.error("Structured AI generation failed; returning validated local fallback.", error instanceof Error ? error.message : "Unknown error");
    return { ...base, worldPrompt: { ...base.worldPrompt, limitations: [...base.worldPrompt.limitations, "Live AI generation failed validation, so a validated local fallback was used."] } };
  }
}
