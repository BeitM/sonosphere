import assert from "node:assert/strict";
import test from "node:test";
import { buildMarblePrompt, enforceMarblePromptLimit, MARBLE_SAFE_LIMIT, normalizeWorldPrompt, removeRepeatedPrompt } from "../lib/analysis/world-prompts.ts";

test("removes an exactly repeated multi-paragraph world plan", () => {
  const first = `Create a coherent location with a persistent landmark. ${"Connected paths and readable materials. ".repeat(10)}`.trim();
  const second = `Build a quieter edge that reconnects to the same landmark. ${"Keep the route stable and explorable. ".repeat(10)}`.trim();
  const plan = `${first}\n\n${second}`;
  assert.equal(removeRepeatedPrompt(`${plan}\n\n${plan}`), plan);
});

test("keeps Marble prompts inside the safety budget with exclusions intact", () => {
  const oversizedPrompt = Array.from(
    { length: 60 },
    (_, index) => `Area ${index + 1} has a distinct connected route, landmark view, material treatment, and spatial purpose.`,
  ).join(" ");
  const result = enforceMarblePromptLimit(oversizedPrompt);
  assert.ok(result.length <= MARBLE_SAFE_LIMIT);
  assert.match(result, /no characters, readable text, logos, timed animation, or cinematic framing/i);
});

test("preserves the selected topology label in normalized Marble output", () => {
  const normalized = normalizeWorldPrompt({ prompt: "Full plan", marblePrompt: "One connected place." }, "layered");
  assert.match(normalized.marblePrompt, /Spatial topology: layered/i);
});

test("concentrates the Marble prompt on one focal area while preserving the larger journey elsewhere", () => {
  const prompt = buildMarblePrompt(
    { balance: "balanced", realism: "mixed", scale: "monumental", intensity: "intense", worldType: "auto", userNote: "" },
    { coreThemes: [{ name: "Surrender and escape" }] },
    {
      environmentConcept: { worldType: "hybrid", setting: "a submerged basalt escarpment", description: "A layered underwater ruin." },
      architecture: { materialLanguage: ["basalt", "wet slate", "oxidized steel", "mineral glass"] },
      palette: { primaryColors: ["blue-black", "green-black", "bone white"], accentColors: ["cyan"] },
      symbolicElements: [{ object: "refractive eye aperture", meaning: "seductive descent", placement: "high in the basin wall", prominence: 0.95 }],
      journey: {
        topology: "layered",
        transformationLogic: "Contrasting conditions remain visible through cross-views.",
        entryExperience: "Enter from an overlook above the basin.",
        areas: [
          { name: "Turning Shelf", role: "entry", description: "A luminous upper shelf." },
          { name: "Undertow Galleries", role: "connector", description: "Cliff-bored connecting passages." },
          { name: "Long Fall Basin", role: "focal", description: "A vast sediment basin crossed by monumental paths." },
        ],
      },
    },
  );

  assert.match(prompt, /exactly one primary explorable area/i);
  assert.match(prompt, /Long Fall Basin/);
  assert.doesNotMatch(prompt, /Turning Shelf|Undertow Galleries/);
  assert.match(prompt, /topology entirely through this area's internal paths/i);
});
