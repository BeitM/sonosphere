import type { Refinement, SongInterpretation, SpatialInterpretation, WorldPrompt } from "@/lib/schemas";

export const MARBLE_DOCUMENTED_LIMIT = 2_000;
export const MARBLE_SAFE_LIMIT = 1_800;

const normalizeForComparison = (value: string) => value.replace(/\s+/g, " ").trim();

function collapseRepeatedUnits(value: string, units: string[], separator: string) {
  if (units.length < 2) return value;
  for (let size = 1; size <= Math.floor(units.length / 2); size += 1) {
    if (units.length % size !== 0) continue;
    const first = units.slice(0, size).map(normalizeForComparison);
    const repeated = units.every((unit, index) => normalizeForComparison(unit) === first[index % size]);
    const candidate = units.slice(0, size).join(separator).trim();
    if (repeated && candidate.length >= 300) return candidate;
  }
  return value;
}

export function removeRepeatedPrompt(value: string) {
  const trimmed = value.trim();
  const paragraphs = trimmed.split(/\n\s*\n/).filter(Boolean);
  const paragraphResult = collapseRepeatedUnits(trimmed, paragraphs, "\n\n");
  if (paragraphResult !== trimmed) return paragraphResult;
  const sentences = trimmed.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [];
  return collapseRepeatedUnits(trimmed, sentences, " ");
}

export function enforceMarblePromptLimit(value: string) {
  const cleaned = removeRepeatedPrompt(value).replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (cleaned.length <= MARBLE_SAFE_LIMIT) return cleaned;

  const requiredEnding = " Static world only: no characters, readable text, logos, timed animation, or cinematic framing.";
  const available = MARBLE_SAFE_LIMIT - requiredEnding.length;
  const provisional = cleaned.slice(0, available);
  const punctuation = Math.max(provisional.lastIndexOf("."), provisional.lastIndexOf("!"), provisional.lastIndexOf("?"));
  const word = provisional.lastIndexOf(" ");
  const cut = punctuation >= available * 0.72 ? punctuation + 1 : word >= available * 0.72 ? word : available;
  return `${provisional.slice(0, cut).trim()}${requiredEnding}`;
}

const scaleInstruction: Record<Refinement["scale"], string> = {
  intimate: "Keep rooms, paths, and distances close and intimate; do not use monumental or landscape-scale geometry.",
  human: "Keep doors, stairs, paths, rooms, structures, and distances believable at human scale; create intensity without oversized geometry.",
  monumental: "Use monumental architectural proportions with clearly walkable human routes, believable stairs, doors, rails, and landings.",
  vast: "Use landscape-scale distance and openness while preserving a clear traversable route and readable orientation landmarks.",
};

export function buildMarblePrompt(refinement: Refinement, interpretation: SongInterpretation, spatial: SpatialInterpretation) {
  const theme = interpretation.coreThemes[0]?.name ?? "the song's central emotional tension";
  const materials = spatial.architecture.materialLanguage.slice(0, 4).join(", ");
  const colors = [...spatial.palette.primaryColors.slice(0, 3), ...spatial.palette.accentColors.slice(0, 1)].join(", ");
  const primaryArea = spatial.journey.areas.find((area) => area.role === "focal") ?? spatial.journey.areas[0];
  const landmark = [...spatial.symbolicElements].sort((a, b) => b.prominence - a.prominence)[0];
  const prompt = [
    `Create one static, explorable ${spatial.environmentConcept.worldType} location: ${spatial.environmentConcept.setting}.`,
    `Hard scale rule: ${refinement.scale}. ${scaleInstruction[refinement.scale]}`,
    `Express ${refinement.intensity} emotional intensity through lighting, exposure, repetition, distance, material contrast, and enclosure—not by changing the selected scale.`,
    `Build exactly one primary explorable area, not a sequence of named zones: ${primaryArea?.name ?? "the central location"}. ${primaryArea?.description ?? spatial.environmentConcept.description}`,
    `Express the ${spatial.journey.topology} topology entirely through this area's internal paths, sightlines, thresholds, and alternate viewpoints. ${spatial.journey.transformationLogic}`,
    `Entry viewpoint: ${spatial.journey.entryExperience}`,
    landmark ? `Primary orientation landmark: ${landmark.object}, meaning ${landmark.meaning.toLowerCase()}, placed ${landmark.placement}. Keep its relationship to the main paths visually recoverable throughout this single location.` : "Keep one orientation landmark visible from the main paths throughout this single location.",
    `Express “${theme}” through accessibility, sightlines, thresholds, and spatial pressure rather than literal lyrics or a music-video recreation.`,
    `Use ${materials}. Palette: ${colors}. Maintain consistent construction, readable ground planes, foreground/midground/background depth, and multiple walkable viewpoints.`,
    "Static environment only: no characters, readable text, logos, branded references, timed animation, cinematic framing, or disconnected dioramas.",
  ].join(" ");
  return enforceMarblePromptLimit(prompt);
}

export function normalizeWorldPrompt(prompt: WorldPrompt, topology?: SpatialInterpretation["journey"]["topology"]): WorldPrompt {
  const marblePrompt = topology && !new RegExp(`\\b${topology}\\b`, "i").test(prompt.marblePrompt)
    ? `Spatial topology: ${topology}. ${prompt.marblePrompt}`
    : prompt.marblePrompt;
  return {
    ...prompt,
    prompt: removeRepeatedPrompt(prompt.prompt),
    marblePrompt: enforceMarblePromptLimit(marblePrompt),
  };
}
