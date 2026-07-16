import type { MusicalAnalysis, SpatialInterpretation } from "@/lib/schemas";

export type SpatialTopology = SpatialInterpretation["journey"]["topology"];

const sectionForce = (section: MusicalAnalysis["sections"][number]) => (section.energy + section.tension + section.rhythmicIntensity) / 3;

export function selectSpatialTopology(music: MusicalAnalysis): SpatialTopology {
  const sections = music.sections;
  const first = sections[0];
  const last = sections.at(-1);
  const peakIndex = sections.reduce((best, section, index) => sectionForce(section) > sectionForce(sections[best]) ? index : best, 0);
  const endpointDistance = first && last
    ? (Math.abs(first.energy - last.energy) + Math.abs(first.tension - last.tension) + Math.abs(first.brightness - last.brightness)) / 3
    : 1;
  const largestShift = sections.slice(1).reduce((largest, section, index) => Math.max(largest, Math.abs(sectionForce(section) - sectionForce(sections[index]))), 0);
  const directionalChange = first && last ? Math.abs(sectionForce(last) - sectionForce(first)) : 0;

  if (directionalChange >= 0.34) return "linear";
  if (music.overall.rhythmicIntensity >= 0.72 && music.overall.density >= 0.55) return "radial";
  if (sections.length >= 3 && endpointDistance <= 0.2 && peakIndex > 0 && peakIndex < sections.length - 1) return "looping";
  if (sections.length >= 5 && largestShift >= 0.16) return "branching";
  if (music.overall.dynamicRange >= 0.62 || largestShift >= 0.28) return "layered";
  return "distributed";
}

export function buildAdaptiveJourney(music: MusicalAnalysis): SpatialInterpretation["journey"] {
  const topology = selectSpatialTopology(music);
  const journeys: Record<SpatialTopology, Omit<SpatialInterpretation["journey"], "topology">> = {
    linear: {
      transformationLogic: "A strong directional change in the recording becomes a continuous route whose material, visibility, and acoustic enclosure evolve without requiring a conventional climax.",
      entryExperience: "Enter where the route's governing material and orientation cue are immediately legible.",
      areas: [
        { name: "Origin edge", role: "entry", description: "A clear arrival area that establishes the world's construction and dominant spatial rhythm.", connections: ["Modulation passage"] },
        { name: "Modulation passage", role: "connector", description: "A continuous traversable band where texture, light, and route density change in the direction measured by the song.", connections: ["Origin edge", "Terminal field"] },
        { name: "Terminal field", role: "focal", description: "A destination that completes the directional change without automatically becoming larger, higher, or more exposed.", connections: ["Modulation passage"] },
      ],
      orientationStrategy: "Use one continuous edge, line, or material seam to make direction readable from every area.",
    },
    looping: {
      transformationLogic: "Because the ending acoustically resembles the opening after an intervening peak, the world returns visitors to familiar ground whose meaning has changed through alternate viewpoints and accumulated detail.",
      entryExperience: "Arrive at a recognizable shared court that can be encountered again from another direction.",
      areas: [
        { name: "Return court", role: "entry", description: "A legible shared space containing the primary landmark and more than one onward route.", connections: ["Outer circuit", "Inner circuit"] },
        { name: "Outer circuit", role: "counterpoint", description: "A longer path that changes distance, texture, and visibility while repeatedly revealing the shared court.", connections: ["Return court", "Inner circuit"] },
        { name: "Inner circuit", role: "return", description: "A tighter route that recombines earlier materials and returns to the arrival point with altered sightlines.", connections: ["Outer circuit", "Return court"] },
      ],
      orientationStrategy: "Keep the shared court or its landmark intermittently visible across both circuits.",
    },
    branching: {
      transformationLogic: "Distinct acoustic regions become multiple valid routes with contrasting spatial treatments; no branch is automatically the climax, and their meaning emerges through comparison and reconnection.",
      entryExperience: "Enter a shared threshold where the available branches and their return paths can be understood at a glance.",
      areas: [
        { name: "Shared threshold", role: "entry", description: "A common orientation space that presents several equally credible directions.", connections: ["Resonant branch", "Counter-route"] },
        { name: "Resonant branch", role: "focal", description: "A route shaped by the recording's densest or most rhythmically insistent evidence.", connections: ["Shared threshold", "Counter-route"] },
        { name: "Counter-route", role: "counterpoint", description: "A contrasting branch shaped by quieter, brighter, or more suspended evidence before reconnecting.", connections: ["Resonant branch", "Shared threshold"] },
      ],
      orientationStrategy: "Use a shared landmark and recurring construction details to make every branch's relationship legible.",
    },
    radial: {
      transformationLogic: "Strong pulse and density become a hub-and-ring organization where intensity is distributed through repetition, interval, and changing access rather than a single oversized destination.",
      entryExperience: "Arrive tangentially so the central organizing space and at least two radial choices are visible together.",
      areas: [
        { name: "Pulse commons", role: "focal", description: "A central navigable area whose repeated structural interval establishes the world's rhythm.", connections: ["Perimeter ring", "Offset chamber"] },
        { name: "Perimeter ring", role: "connector", description: "A continuous loop offering repeated views inward and outward with subtle variations at each interval.", connections: ["Pulse commons", "Offset chamber"] },
        { name: "Offset chamber", role: "counterpoint", description: "An attached area that interrupts the governing repetition through a different material or degree of enclosure.", connections: ["Perimeter ring", "Pulse commons"] },
      ],
      orientationStrategy: "Use the center, repeated radial lines, and ring continuity together rather than relying on a distant destination.",
    },
    layered: {
      transformationLogic: "Large measured contrasts become adjacent or overlapping spatial layers; visitors can compare them through thresholds and cross-views without assuming that the most intense layer must be largest.",
      entryExperience: "Enter at a seam where two spatial conditions are simultaneously perceptible.",
      areas: [
        { name: "Quiet layer", role: "entry", description: "A traversable condition shaped by the recording's more restrained material and spectral evidence.", connections: ["Shared seam"] },
        { name: "Shared seam", role: "connector", description: "A thick threshold with cross-views and short routes linking the contrasting layers.", connections: ["Quiet layer", "Charged layer"] },
        { name: "Charged layer", role: "focal", description: "A contrasting condition expressed through density, light, texture, and proximity while preserving the selected scale.", connections: ["Shared seam"] },
      ],
      orientationStrategy: "Make the shared seam continuously traceable through consistent joints, openings, or material boundaries.",
    },
    distributed: {
      transformationLogic: "Subtle acoustic change becomes a field of related places rather than a dramatic sequence; emphasis shifts through proximity, texture, and viewpoint without a singular climax.",
      entryExperience: "Enter from within the field with two nearby anchors already visible and no privileged forward axis.",
      areas: [
        { name: "Near anchor", role: "entry", description: "A tactile local marker that establishes scale and material logic.", connections: ["Middle anchor", "Far anchor"] },
        { name: "Middle anchor", role: "connector", description: "A related place reached by more than one route, revealing gradual environmental variation.", connections: ["Near anchor", "Far anchor"] },
        { name: "Far anchor", role: "reflective", description: "A quiet counterpart that changes the reading of the other anchors without serving as a conventional ending.", connections: ["Middle anchor", "Near anchor"] },
      ],
      orientationStrategy: "Use intervisible anchors and overlapping paths so orientation comes from relationships rather than a single landmark.",
    },
  };

  return { topology, ...journeys[topology] };
}
