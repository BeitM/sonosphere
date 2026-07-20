import assert from "node:assert/strict";
import test from "node:test";
import { buildReferenceImagePrompt } from "../lib/reference-images.ts";
import { getWorldGeneration, requireGenerationAccess, startWorldGeneration, WorldLabsRequestError } from "../lib/worldlabs/client.ts";
import { normalizeWorldLabsOperation, worldLabsGenerateRequestSchema } from "../lib/worldlabs/schemas.ts";

const originalApiKey = process.env.WORLD_LABS_API_KEY;
const originalApiUrl = process.env.WORLD_LABS_API_URL;
const originalAccessToken = process.env.WORLD_LABS_ACCESS_TOKEN;

test.before(() => {
  process.env.WORLD_LABS_API_KEY = "world-labs-test-key";
  process.env.WORLD_LABS_API_URL = "https://world-labs.test/marble/v1";
  delete process.env.WORLD_LABS_ACCESS_TOKEN;
});

test.after(() => {
  if (originalApiKey === undefined) delete process.env.WORLD_LABS_API_KEY;
  else process.env.WORLD_LABS_API_KEY = originalApiKey;
  if (originalApiUrl === undefined) delete process.env.WORLD_LABS_API_URL;
  else process.env.WORLD_LABS_API_URL = originalApiUrl;
  if (originalAccessToken === undefined) delete process.env.WORLD_LABS_ACCESS_TOKEN;
  else process.env.WORLD_LABS_ACCESS_TOKEN = originalAccessToken;
});

test("starts one private text generation with the selected Marble model", async () => {
  let captured;
  const fetcher = async (url, init) => {
    captured = { url, init };
    return Response.json({
      operation_id: "20bffbb1-4ba7-453f-a116-93eab1a6843e",
      done: false,
      error: null,
      metadata: null,
      response: null,
    });
  };

  const operation = await startWorldGeneration({
    prompt: "A connected nocturnal garden with one luminous orientation landmark.",
    displayName: "Test world",
    model: "marble-1.1-plus",
  }, fetcher);

  assert.equal(operation.done, false);
  assert.equal(captured.url, "https://world-labs.test/marble/v1/worlds:generate");
  assert.equal(captured.init.method, "POST");
  assert.equal(new Headers(captured.init.headers).get("WLT-Api-Key"), "world-labs-test-key");
  const body = JSON.parse(captured.init.body);
  assert.equal(body.model, "marble-1.1-plus");
  assert.deepEqual(body.permission, { public: false, allow_id_access: false, allowed_readers: [], allowed_writers: [] });
  assert.deepEqual(body.world_prompt, {
    type: "text",
    text_prompt: "A connected nocturnal garden with one luminous orientation landmark.",
    disable_recaption: true,
  });
});

test("submits one panorama with the text prompt as image-conditioned generation", async () => {
  let captured;
  const fetcher = async (url, init) => {
    captured = { url, init };
    return Response.json({ operation_id: "panorama-operation", done: false, error: null, metadata: null, response: null });
  };
  const image = { dataBase64: "c29ub3NwaGVyZS1wYW5vcmFtYQ==", extension: "jpg", isPanorama: true };

  await startWorldGeneration({
    prompt: "A coherent nocturnal garden with a clear ground plane and luminous landmark.",
    displayName: "Panorama world",
    model: "marble-1.1-plus",
    referenceImages: [image],
  }, fetcher);

  const body = JSON.parse(captured.init.body);
  assert.deepEqual(body.world_prompt, {
    type: "image",
    image_prompt: { source: "data_base64", data_base64: image.dataBase64, extension: "jpg" },
    is_pano: true,
    text_prompt: "A coherent nocturnal garden with a clear ground plane and luminous landmark.",
    disable_recaption: true,
  });
});

test("supports complementary directional images without treating them as panoramas", async () => {
  let body;
  const fetcher = async (_url, init) => {
    body = JSON.parse(init.body);
    return Response.json({ operation_id: "multi-image-operation", done: false, error: null, metadata: null, response: null });
  };
  await startWorldGeneration({
    prompt: "A coherent environment seen from complementary directions with matching materials.",
    displayName: "Multi-image world",
    model: "marble-1.1",
    referenceImages: [
      { dataBase64: "ZnJvbnQtdmlldw==", extension: "jpg", isPanorama: false, azimuth: 0 },
      { dataBase64: "YmFjay12aWV3", extension: "jpg", isPanorama: false, azimuth: 180 },
    ],
  }, fetcher);

  assert.equal(body.world_prompt.type, "multi-image");
  assert.deepEqual(body.world_prompt.multi_image_prompt.map((image) => image.azimuth), [0, 180]);
  assert.equal(body.world_prompt.text_prompt.includes("complementary directions"), true);
});

test("reference prompt requests one seamless navigable equirectangular environment", () => {
  const prompt = buildReferenceImagePrompt("A moonlit stone courtyard with one glass tower.");
  assert.match(prompt, /2:1 equirectangular 360-degree panorama/i);
  assert.match(prompt, /one coherent place, not a collage/i);
  assert.match(prompt, /navigable ground plane/i);
  assert.match(prompt, /moonlit stone courtyard/i);
});

test("rejects combining a panorama with additional reference images", () => {
  const dataBase64 = "a".repeat(120);
  assert.throws(() => worldLabsGenerateRequestSchema.parse({
    prompt: "A coherent environment with sufficient detail for a valid generation request.",
    displayName: "Invalid panorama mix",
    model: "marble-1.1",
    referenceImages: [
      { dataBase64, extension: "jpg", isPanorama: true },
      { dataBase64, extension: "jpg", isPanorama: false },
    ],
  }));
});

test("normalizes a completed world and its Spark rendering metadata", async () => {
  const fetcher = async () => Response.json({
    operation_id: "20bffbb1-4ba7-453f-a116-93eab1a6843e",
    done: true,
    error: null,
    metadata: { progress: { status: "SUCCEEDED", description: "World generation completed successfully" } },
    cost: { total_credits: 1_580, line_items: [{ name: "world", credits: 1_500 }, { name: "pano", credits: 80 }] },
    response: {
      id: "dc2c65e4-68d3-4210-a01e-7a54cc9ded2a",
      display_name: "Test world",
      world_marble_url: "https://marble.worldlabs.ai/world/dc2c65e4-68d3-4210-a01e-7a54cc9ded2a",
      model: "marble-1.1",
      assets: {
        caption: "A connected test environment.",
        thumbnail_url: "https://assets.test/thumbnail.png",
        splats: {
          spz_urls: { "100k": "https://assets.test/100k.spz", "500k": "https://assets.test/500k.spz" },
          semantics_metadata: { metric_scale_factor: 1.23, ground_plane_offset: 0.42 },
        },
        mesh: { collider_mesh_url: "https://assets.test/collider.glb" },
        imagery: { pano_url: "https://assets.test/pano.jpg" },
      },
    },
  });

  const operation = await getWorldGeneration("20bffbb1-4ba7-453f-a116-93eab1a6843e", fetcher);
  assert.equal(operation.world?.spzUrls["500k"], "https://assets.test/500k.spz");
  assert.equal(operation.world?.semantics.metricScaleFactor, 1.23);
  assert.equal(operation.world?.semantics.groundPlaneOffset, 0.42);
  assert.deepEqual(operation.cost, { totalCredits: 1_580 });
});

test("rejects malformed World Labs responses before they reach the UI", () => {
  assert.throws(() => normalizeWorldLabsOperation({ operation_id: "missing-done" }));
});

test("allows localhost without a second secret and protects hosted paid generation", () => {
  delete process.env.WORLD_LABS_ACCESS_TOKEN;
  assert.doesNotThrow(() => requireGenerationAccess(new Request("http://localhost/api/world-labs/generate")));
  assert.throws(
    () => requireGenerationAccess(new Request("https://sonosphere.example/api/world-labs/generate")),
    (error) => error instanceof WorldLabsRequestError && error.status === 503,
  );

  process.env.WORLD_LABS_ACCESS_TOKEN = "private-access-code";
  assert.throws(
    () => requireGenerationAccess(new Request("https://sonosphere.example/api/world-labs/generate")),
    (error) => error instanceof WorldLabsRequestError && error.status === 401,
  );
  assert.doesNotThrow(() => requireGenerationAccess(new Request("https://sonosphere.example/api/world-labs/generate", {
    headers: { authorization: "Bearer private-access-code" },
  })));
  delete process.env.WORLD_LABS_ACCESS_TOKEN;
});
