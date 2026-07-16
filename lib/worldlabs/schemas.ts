import { z } from "zod";

export const worldLabsModelSchema = z.enum(["marble-1.0-draft", "marble-1.1", "marble-1.1-plus"]);

export const worldLabsGenerateRequestSchema = z.object({
  prompt: z.string().min(20).max(2_000),
  displayName: z.string().min(1).max(64),
  model: worldLabsModelSchema.default("marble-1.1-plus"),
});

const semanticsSchema = z.object({
  metric_scale_factor: z.number().positive().nullable().optional(),
  ground_plane_offset: z.number().nullable().optional(),
}).passthrough();

const worldAssetsSchema = z.object({
  caption: z.string().nullable().optional(),
  thumbnail_url: z.string().url().nullable().optional(),
  splats: z.object({
    spz_urls: z.record(z.string(), z.string().url()).nullable().optional(),
    semantics_metadata: semanticsSchema.nullable().optional(),
  }).passthrough().nullable().optional(),
  mesh: z.object({ collider_mesh_url: z.string().url().nullable().optional() }).passthrough().nullable().optional(),
  imagery: z.object({ pano_url: z.string().url().nullable().optional() }).passthrough().nullable().optional(),
}).passthrough().nullable().optional();

const rawWorldSchema = z.object({
  id: z.string().optional(),
  world_id: z.string().optional(),
  display_name: z.string().nullable().optional(),
  world_marble_url: z.string().url(),
  assets: worldAssetsSchema,
  model: z.string().nullable().optional(),
}).passthrough().refine((world) => Boolean(world.world_id || world.id), { message: "World response did not include an ID." });

const operationErrorSchema = z.object({
  code: z.union([z.string(), z.number()]).nullable().optional(),
  message: z.string().nullable().optional(),
}).passthrough();

export const rawWorldLabsOperationSchema = z.object({
  operation_id: z.string(),
  done: z.boolean(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  expires_at: z.string().nullable().optional(),
  error: operationErrorSchema.nullable().optional(),
  metadata: z.object({
    world_id: z.string().nullable().optional(),
    progress: z.object({ status: z.string().optional(), description: z.string().optional(), percentage: z.number().optional() }).passthrough().nullable().optional(),
  }).passthrough().nullable().optional(),
  response: rawWorldSchema.nullable().optional(),
  cost: z.object({
    total_credits: z.number().nonnegative(),
    line_items: z.array(z.object({ name: z.string(), credits: z.number().nonnegative() }).passthrough()).optional(),
  }).passthrough().nullable().optional(),
}).passthrough();

export type WorldLabsModel = z.infer<typeof worldLabsModelSchema>;

export type WorldLabsWorld = {
  worldId: string;
  displayName: string;
  marbleUrl: string;
  model: string | null;
  caption: string | null;
  thumbnailUrl: string | null;
  panoUrl: string | null;
  colliderUrl: string | null;
  spzUrls: Record<string, string>;
  semantics: { metricScaleFactor: number; groundPlaneOffset: number };
};

export type WorldLabsOperation = {
  operationId: string;
  done: boolean;
  status: string;
  description: string;
  progress: number | null;
  error: { code?: string | number; message: string } | null;
  cost: { totalCredits: number } | null;
  world: WorldLabsWorld | null;
};

export const WORLD_LABS_MODELS: Record<WorldLabsModel, { label: string; credits: string; note: string }> = {
  "marble-1.0-draft": { label: "Marble 1.0 Draft", credits: "230 credits", note: "Low-credit pipeline test" },
  "marble-1.1": { label: "Marble 1.1", credits: "1,580 credits", note: "Standard world generation" },
  "marble-1.1-plus": { label: "Marble 1.1 Plus", credits: "1,580–3,080 credits", note: "Dynamic sizing for larger worlds" },
};

export function normalizeWorldLabsOperation(input: unknown): WorldLabsOperation {
  const raw = rawWorldLabsOperationSchema.parse(input);
  const world = raw.response;
  const assets = world?.assets;
  const semantics = assets?.splats?.semantics_metadata;
  return {
    operationId: raw.operation_id,
    done: raw.done,
    status: raw.metadata?.progress?.status ?? (raw.done ? raw.error ? "FAILED" : "SUCCEEDED" : "QUEUED"),
    description: raw.metadata?.progress?.description ?? (raw.done ? "World generation finished" : "World generation queued"),
    progress: raw.metadata?.progress?.percentage ?? null,
    error: raw.error ? { code: raw.error.code ?? undefined, message: raw.error.message ?? "World Labs reported an unspecified generation error." } : null,
    cost: raw.cost ? { totalCredits: raw.cost.total_credits } : null,
    world: world ? {
      worldId: world.world_id ?? world.id ?? "",
      displayName: world.display_name ?? "Generated world",
      marbleUrl: world.world_marble_url,
      model: world.model ?? null,
      caption: assets?.caption ?? null,
      thumbnailUrl: assets?.thumbnail_url ?? null,
      panoUrl: assets?.imagery?.pano_url ?? null,
      colliderUrl: assets?.mesh?.collider_mesh_url ?? null,
      spzUrls: assets?.splats?.spz_urls ?? {},
      semantics: {
        metricScaleFactor: semantics?.metric_scale_factor ?? 1,
        groundPlaneOffset: semantics?.ground_plane_offset ?? 0,
      },
    } : null,
  };
}
