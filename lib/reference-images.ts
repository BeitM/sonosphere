import OpenAI from "openai";
import { z } from "zod";

export const referenceImageRequestSchema = z.object({
  prompt: z.string().min(20).max(2_000),
});

export type GeneratedReferenceImage = {
  id: string;
  label: string;
  dataBase64: string;
  extension: "jpg";
  mimeType: "image/jpeg";
  isPanorama: true;
};

export class ReferenceImageGenerationError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function buildReferenceImagePrompt(worldPrompt: string) {
  return [
    "Create one seamless 2:1 equirectangular 360-degree panorama as a spatial reference for reconstructing an explorable 3D environment.",
    "Render the entire horizon around a single standing viewpoint with correct equirectangular projection, a level horizon, continuous geometry at the left and right seam, and no duplicated landmark.",
    "This must be one coherent place, not a collage, triptych, cutaway, map, concept sheet, or collection of camera views.",
    "Keep a clearly navigable ground plane around the viewpoint, believable entrances and paths, strong foreground/midground/background depth, consistent architectural scale, and one recoverable orientation landmark.",
    "Favor environmental structure, material specificity, atmosphere, and lighting. No people, creatures, text, signage, logos, frames, captions, interface elements, or fisheye circular border.",
    "Environment brief:",
    worldPrompt,
  ].join("\n\n");
}

export async function generateReferencePanorama(worldPrompt: string): Promise<GeneratedReferenceImage> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new ReferenceImageGenerationError("Reference-image generation is not configured. Add OPENAI_API_KEY to the server environment.", 503);
  const model = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2";
  try {
    const result = await new OpenAI({ apiKey }).images.generate({
      model,
      prompt: buildReferenceImagePrompt(worldPrompt),
      n: 1,
      size: "2048x1024",
      quality: "medium",
      output_format: "jpeg",
      output_compression: 85,
      background: "opaque",
    });
    const dataBase64 = result.data?.[0]?.b64_json;
    if (!dataBase64) throw new ReferenceImageGenerationError("OpenAI completed the request without returning an image.", 502);
    return {
      id: crypto.randomUUID(),
      label: "360° environment reference",
      dataBase64,
      extension: "jpg",
      mimeType: "image/jpeg",
      isPanorama: true,
    };
  } catch (error) {
    if (error instanceof ReferenceImageGenerationError) throw error;
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "moderation_blocked") {
      throw new ReferenceImageGenerationError("The visual reference was blocked by an image safety check. Adjust the world description and try again.", 400);
    }
    throw new ReferenceImageGenerationError("The visual reference could not be generated. Check the OpenAI image model, API access, and account quota.", 502);
  }
}
