import assert from "node:assert/strict";
import test from "node:test";
import { buildAdaptiveJourney, selectSpatialTopology } from "../lib/analysis/spatial-journey.ts";

const section = (energy, tension, rhythmicIntensity, brightness = 0.5) => ({ energy, tension, rhythmicIntensity, brightness });
const music = (sections, overall = {}) => ({
  sections,
  overall: { energy: 0.5, tension: 0.5, rhythmicIntensity: 0.4, brightness: 0.5, density: 0.4, dynamicRange: 0.4, ...overall },
});

test("selects different spatial topologies from different acoustic relationships", () => {
  assert.equal(selectSpatialTopology(music([
    section(0.4, 0.4, 0.8),
    section(0.55, 0.5, 0.9),
    section(0.45, 0.45, 0.85),
  ], { rhythmicIntensity: 0.88, density: 0.78 })), "radial");

  assert.equal(selectSpatialTopology(music([
    section(0.25, 0.3, 0.3, 0.4),
    section(0.9, 0.82, 0.6, 0.7),
    section(0.27, 0.28, 0.31, 0.42),
  ])), "looping");

  assert.equal(selectSpatialTopology(music([
    section(0.1, 0.1, 0.1),
    section(0.5, 0.55, 0.5),
    section(0.9, 0.85, 0.8),
  ])), "linear");
});

test("adaptive journeys describe connected areas without a required climax field", () => {
  const journey = buildAdaptiveJourney(music([
    section(0.35, 0.3, 0.25),
    section(0.42, 0.38, 0.3),
    section(0.39, 0.34, 0.28),
  ]));
  assert.ok(journey.areas.length >= 2);
  assert.ok(journey.areas.every((area) => area.connections.length > 0));
  assert.equal("climaxSpace" in journey, false);
});
