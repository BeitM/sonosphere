import type { WorldLabsModel, WorldLabsOperation, WorldLabsReferenceImage } from "./schemas.ts";
import { normalizeWorldLabsOperation } from "./schemas.ts";

const DEFAULT_API_URL = "https://api.worldlabs.ai/marble/v1";

export class WorldLabsRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function configuration() {
  const apiKey = process.env.WORLD_LABS_API_KEY?.trim();
  if (!apiKey) throw new WorldLabsRequestError("World Labs generation is not configured. Add WORLD_LABS_API_KEY to the server environment.", 503);
  return { apiKey, baseUrl: (process.env.WORLD_LABS_API_URL || DEFAULT_API_URL).replace(/\/$/, "") };
}

export function requireGenerationAccess(request: Request) {
  const expected = process.env.WORLD_LABS_ACCESS_TOKEN?.trim();
  const hostname = new URL(request.url).hostname;
  const local = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  if (!expected && !local) throw new WorldLabsRequestError("Hosted World Labs generation requires WORLD_LABS_ACCESS_TOKEN to protect paid credits.", 503);
  if (!expected) return;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (supplied !== expected) throw new WorldLabsRequestError("The World Labs generation access code is missing or incorrect.", 401);
}

async function worldLabsFetch(path: string, init: RequestInit, fetcher: typeof fetch): Promise<unknown> {
  const { apiKey, baseUrl } = configuration();
  let response: Response;
  try {
    response = await fetcher(`${baseUrl}${path}`, {
      ...init,
      headers: { "WLT-Api-Key": apiKey, ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new WorldLabsRequestError(error instanceof Error ? `World Labs could not be reached: ${error.message}` : "World Labs could not be reached.", 502);
  }
  const text = await response.text();
  let body: unknown = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
  if (!response.ok) {
    const detail = body && typeof body === "object" && "detail" in body ? String(body.detail) : "";
    const error = body && typeof body === "object" && "error" in body ? String(body.error) : "";
    throw new WorldLabsRequestError(detail || error || `World Labs returned HTTP ${response.status}.`, response.status);
  }
  return body;
}

function worldPrompt(prompt: string, referenceImages: WorldLabsReferenceImage[]) {
  const content = (image: WorldLabsReferenceImage) => ({
    source: "data_base64" as const,
    data_base64: image.dataBase64,
    extension: image.extension,
  });
  if (referenceImages.length === 1) {
    const image = referenceImages[0];
    return {
      type: "image",
      image_prompt: content(image),
      is_pano: image.isPanorama,
      text_prompt: prompt,
      disable_recaption: true,
    };
  }
  if (referenceImages.length > 1) {
    return {
      type: "multi-image",
      multi_image_prompt: referenceImages.map((image) => ({
        ...(image.azimuth == null ? {} : { azimuth: image.azimuth }),
        content: content(image),
      })),
      reconstruct_images: false,
      text_prompt: prompt,
      disable_recaption: true,
    };
  }
  return { type: "text", text_prompt: prompt, disable_recaption: true };
}

export async function startWorldGeneration(input: { prompt: string; displayName: string; model: WorldLabsModel; referenceImages?: WorldLabsReferenceImage[] }, fetcher: typeof fetch = fetch): Promise<WorldLabsOperation> {
  const raw = await worldLabsFetch("/worlds:generate", {
    method: "POST",
    body: JSON.stringify({
      display_name: input.displayName,
      model: input.model,
      tags: ["sonosphere"],
      permission: { public: false, allow_id_access: false, allowed_readers: [], allowed_writers: [] },
      world_prompt: worldPrompt(input.prompt, input.referenceImages ?? []),
    }),
  }, fetcher);
  return normalizeWorldLabsOperation(raw);
}

export async function getWorldGeneration(operationId: string, fetcher: typeof fetch = fetch): Promise<WorldLabsOperation> {
  return normalizeWorldLabsOperation(await worldLabsFetch(`/operations/${encodeURIComponent(operationId)}`, { method: "GET" }, fetcher));
}
