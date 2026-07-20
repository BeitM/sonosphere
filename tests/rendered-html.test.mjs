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
  assert.match(html, /Analysis studio/);
  assert.doesNotMatch(html, /DEVELOPMENT FIXTURES|Amazing Grace|Glass Orchard|Untitled Current/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("unknown instrumental uses fallback level four and normalized weights", async () => {
  const body = {
    fixtureId: "instrumental",
    useFixture: true,
    identification: { confidence: 0.08, provider: "Sonicprint Mock", alternatives: [] },
    confirmed: { title: "Untitled Current", artist: "", album: "" },
    refinement: { balance: "music", realism: "mixed", scale: "vast", intensity: "intense", worldType: "auto", userNote: "Preserve the changed stillness." },
  };
  const response = await (await worker()).fetch(new Request("http://localhost/api/world/generate-prompt", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), env, ctx);
  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.fallbackLevel, 4);
  assert.ok(json.worldPrompt.prompt.includes("explorable 3D environment"));
  assert.ok(json.worldPrompt.marblePrompt.length <= 1800);
  assert.match(json.worldPrompt.marblePrompt, /Hard scale rule: vast/i);
  assert.match(json.worldPrompt.marblePrompt, /one static, explorable/i);
  assert.ok(["linear", "looping", "branching", "radial", "layered", "distributed"].includes(json.spatialInterpretation.journey.topology));
  assert.match(json.worldPrompt.marblePrompt, new RegExp(`${json.spatialInterpretation.journey.topology} topology`, "i"));
  assert.ok(json.spatialInterpretation.journey.areas.length >= 2);
  assert.equal("climaxSpace" in json.spatialInterpretation.journey, false);
  assert.ok(json.worldPrompt.generationGuidance.preserveSpatialContinuity);
  const total = Object.values(json.weights).reduce((sum, value) => sum + value, 0);
  assert.ok(Math.abs(total - 1) < 1e-10);
});

test("multipart identification accepts audio bodies larger than vinext's default one megabyte", async () => {
  const body = new FormData();
  body.append("audio", new Blob([new Uint8Array(2 * 1024 * 1024)], { type: "audio/mpeg" }), "upload.mp3");
  body.append("useFixture", "false");
  body.append("title", "Upload test");
  body.append("artist", "Test artist");
  const response = await (await worker()).fetch(new Request("http://localhost/api/song/identify", { method: "POST", body }), env, ctx);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /application\/json/);
  const json = await response.json();
  assert.equal(json.provider, "User-confirmed identity");
  assert.equal(json.confidence, 1);
});

test("real-upload generation consumes supplied acoustic analysis", async () => {
  const body = {
    fixtureId: "known",
    useFixture: false,
    identification: { title: "Signal Garden", artist: "Test Artist", confidence: 1, provider: "User-confirmed identity", alternatives: [] },
    confirmed: { title: "Signal Garden", artist: "Test Artist", album: "" },
    musicAnalysis: {
      durationSeconds: 180,
      tempoBpm: 124,
      key: "D",
      mode: "minor",
      overall: { energy: 0.72, valence: 0.38, tension: 0.68, brightness: 0.44, density: 0.7, rhythmicIntensity: 0.76, vocalProminence: 0.2, dynamicRange: 0.81 },
      sections: [
        { id: "section-1", label: "intro", startTime: 0, endTime: 45, energy: 0.25, tension: 0.35, loudness: 0.28, brightness: 0.38, rhythmicIntensity: 0.3, vocalIntensity: 0.1, description: "Restrained opening." },
        { id: "section-2", label: "chorus", startTime: 45, endTime: 140, energy: 0.9, tension: 0.8, loudness: 0.88, brightness: 0.52, rhythmicIntensity: 0.9, vocalIntensity: 0.2, description: "Dense central peak." },
        { id: "section-3", label: "outro", startTime: 140, endTime: 180, energy: 0.4, tension: 0.3, loudness: 0.42, brightness: 0.4, rhythmicIntensity: 0.35, vocalIntensity: 0.1, description: "Calmer ending." },
      ],
      notableMoments: [],
      confidence: { tempo: 0.9, key: 0.7, sectionDetection: 0.66, emotionalFeatures: 0.62 },
      provider: "Sonosphere librosa analyzer v1",
    },
    manualLyrics: "Fabricated test lyrics supplied only to keep this integration test offline.",
    refinement: { balance: "music", realism: "mixed", scale: "vast", intensity: "intense", worldType: "auto", userNote: "" },
  };
  const response = await (await worker()).fetch(new Request("http://localhost/api/world/generate-prompt", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), env, ctx);
  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.music.provider, "Sonosphere librosa analyzer v1");
  assert.match(json.interpretation.summary, /124 BPM/);
  assert.match(json.worldPrompt.prompt, /124 BPM pulse/);
  assert.ok(json.worldPrompt.marblePrompt.length <= 1800);
  assert.match(json.worldPrompt.marblePrompt, /Hard scale rule: vast/i);
  assert.doesNotMatch(json.worldPrompt.marblePrompt, /(.{300,})\1/s);
  assert.doesNotMatch(json.worldPrompt.prompt, /highest-intensity section opens into the largest/i);
  assert.match(json.worldPrompt.limitations.join(" "), /extracted from the uploaded recording/i);
  assert.doesNotMatch(json.worldPrompt.limitations.join(" "), /curated fixtures/i);
});
