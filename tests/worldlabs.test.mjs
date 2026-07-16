import assert from "node:assert/strict";
import test from "node:test";
import { getWorldGeneration, requireGenerationAccess, startWorldGeneration, WorldLabsRequestError } from "../lib/worldlabs/client.ts";
import { normalizeWorldLabsOperation } from "../lib/worldlabs/schemas.ts";

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
