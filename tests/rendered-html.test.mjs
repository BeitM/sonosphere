import assert from "node:assert/strict";
import test from "node:test";

async function worker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  return (await import(workerUrl.href)).default;
}

const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
const ctx = { waitUntil() {}, passThroughOnException() {} };

test("server-renders the Sonosphere studio", async () => {
  const response = await (await worker()).fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), env, ctx);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Sonosphere — turn a song into a world<\/title>/i);
  assert.match(html, /Turn a song into/);
  assert.match(html, /Development mode/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("unknown instrumental uses fallback level four and normalized weights", async () => {
  const body = {
    fixtureId: "instrumental",
    identification: { confidence: 0.08, provider: "Sonicprint Mock", alternatives: [] },
    confirmed: { title: "Untitled Current", artist: "", album: "" },
    refinement: { balance: "music", realism: "mixed", scale: "vast", intensity: "intense", worldType: "auto", userNote: "Preserve the changed stillness." },
  };
  const response = await (await worker()).fetch(new Request("http://localhost/api/world/generate-prompt", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), env, ctx);
  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.fallbackLevel, 4);
  assert.ok(json.worldPrompt.prompt.includes("explorable 3D environment"));
  assert.ok(json.worldPrompt.generationGuidance.preserveSpatialContinuity);
  const total = Object.values(json.weights).reduce((sum, value) => sum + value, 0);
  assert.ok(Math.abs(total - 1) < 1e-10);
});
