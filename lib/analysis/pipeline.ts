import { providers } from "@/lib/providers/mock";
import { songWorldAnalysisSchema, type GenerateRequest, type SongInterpretation, type SongWorldAnalysis, type SpatialInterpretation, type WorldPrompt } from "@/lib/schemas";
import { calculateConfidence, calculateEvidenceWeights, fallbackLevel } from "./weights";
import { enhanceWithOpenAI } from "@/lib/ai/openai";

const pct = (n: number) => Math.round(n * 100);
const contextCount = (context: Awaited<ReturnType<typeof providers.context.research>>) => Object.values(context).flat().length;

function buildInterpretation(input: GenerateRequest, music: Awaited<ReturnType<typeof providers.music.analyze>>, lyrics: Awaited<ReturnType<typeof providers.lyrics.findLyrics>>, level: number): SongInterpretation {
  const hasWords = lyrics.available;
  const guidance = [input.personalInterpretation, input.emphasisNote, input.refinement.userNote].filter(Boolean).join(" ");
  const isKnown = input.fixtureId === "known";
  const isObscure = input.fixtureId === "obscure";
  const summary = isKnown
    ? "A passage from estrangement toward belonging, where transformation does not erase vulnerability but makes a wider world perceptible. The restrained opening and expanding harmony turn recognition into a physical sense of space opening around the listener."
    : isObscure
      ? "A meditation on protecting something delicate inside systems built for pressure and repetition. Fragility is not presented as weakness: the musical climax lets the mechanical and organic coexist without resolving their tension."
      : "An instrumental journey from isolation into turbulent collective motion, followed by a changed stillness. With no reliable lyrics or identity, the interpretation rests on density, rhythm, dynamic contrast, and the listener's guidance.";
  const themes: SongInterpretation["coreThemes"] = isKnown
    ? [
        { name: "Transformation through recognition", description: "The central movement is from disorientation toward perception, expressed as a widening field of possible movement.", confidence: 0.92, evidenceSources: ["lyrics", "music", "published_interpretation"] },
        { name: "Belonging without certainty", description: "Arrival is visible but never effortless; humility remains embedded in the destination.", confidence: 0.8, evidenceSources: ["lyrics", "common_interpretation", "ai_inference"] },
      ]
    : isObscure
      ? [
          { name: "Fragility under pressure", description: "Transparent organic imagery meets dense, machine-like rhythm.", confidence: 0.86, evidenceSources: ["lyrics", "music"] },
          { name: "Preservation versus change", description: "The desire to protect becomes inseparable from the forces threatening it.", confidence: 0.72, evidenceSources: ["lyrics", "ai_inference"] },
        ]
      : [
          { name: "Accumulation and release", description: "Layered rhythm converts empty distance into overwhelming motion before dissolving.", confidence: 0.84, evidenceSources: ["music"] },
          { name: "Changed return", description: "The ending resembles the opening but carries the resonance of the climax.", confidence: 0.77, evidenceSources: ["music", "ai_inference"] },
        ];
  if (guidance) themes.push({ name: "Listener emphasis", description: `User guidance suggests: ${guidance}`, confidence: 0.62, evidenceSources: ["user_guidance"] });
  return {
    summary,
    coreThemes: themes.map((theme) => ({ ...theme, evidenceSources: [...theme.evidenceSources] })),
    emotionalConflicts: isObscure
      ? [{ sideA: "Protection", sideB: "Transformation", explanation: "The same enclosure that shelters the delicate orchard can also prevent it from living." }]
      : [{ sideA: level === 4 ? "Solitude" : "Estrangement", sideB: level === 4 ? "Collective motion" : "Belonging", explanation: "The song makes the desired state perceptible before it becomes reachable." }],
    narrativePerspective: hasWords ? "An intimate first-person witness moving through remembered limitation toward an altered understanding." : "A non-verbal environmental perspective inferred from musical motion.",
    recurringImages: isObscure
      ? [{ image: "transparent fruit", meaning: "Care made visible and therefore vulnerable", confidence: 0.82 }, { image: "distant machinery", meaning: "Pressure that is structural rather than villainous", confidence: 0.72 }]
      : isKnown
        ? [{ image: "a distant illuminated threshold", meaning: "Belonging that can be perceived before it can be entered", confidence: 0.86 }, { image: "surfaces becoming translucent", meaning: "Perception replacing certainty", confidence: 0.76 }]
        : [{ image: "converging currents", meaning: "Independent pulses becoming a shared force", confidence: 0.78 }],
    musicLyricsRelationship: { type: hasWords ? "evolving" : "unclear", explanation: hasWords ? "The arrangement begins smaller than the language's promise, then spatially expands until the musical world can hold that promise." : "No reliable lyric evidence is available; the arc is inferred only from musical structure." },
    emotionalArc: music.sections.map((section, index) => ({
      sectionId: section.id,
      emotionalState: index === 0 ? "watchful distance" : index === music.sections.length - 1 ? "altered calm" : section.energy > 0.8 ? "overwhelming confrontation" : section.tension > 0.65 ? "compressed uncertainty" : "tentative movement",
      intensity: Math.max(section.energy, section.tension),
      interpretation: section.description ?? `${section.label} shifts the balance of energy and space.`,
    })),
    uncertaintyNotes: [
      ...(level >= 3 ? ["Lyrical meaning is uncertain because reliable lyrics are unavailable."] : []),
      ...(level === 4 ? ["Song identity is unknown; no artist intent or release context is assumed."] : []),
      "Spatial symbolism is a creative synthesis, not a factual claim about creator intent.",
    ],
  };
}

function buildSpatial(input: GenerateRequest): SpatialInterpretation {
  const obscure = input.fixtureId === "obscure";
  const instrumental = input.fixtureId === "instrumental";
  const setting = input.refinement.worldType !== "auto" ? `${input.refinement.worldType} environment` : obscure ? "a transparent orchard threaded through an abandoned precision works" : instrumental ? "a tidal plain of resonant stone and suspended metallic spans" : "a vast threshold-city carved into pale stone around a luminous inner sanctuary";
  const scale = { intimate: 0.25, human: 0.45, monumental: 0.76, vast: 0.95 }[input.refinement.scale];
  return {
    centralSpatialMetaphor: {
      concept: obscure ? "A living orchard inside an indifferent machine" : instrumental ? "Separate currents gathering into one navigable surge" : "A visible sanctuary reached by learning to perceive the path",
      explanation: obscure ? "Organic chambers and mechanical corridors occupy the same structure, turning preservation into a spatial negotiation." : instrumental ? "Paths begin isolated, converge in a turbulent central basin, then separate again with shared resonance." : "Warmth remains visible across distance while walls, scale, and partial transparency change as understanding grows.",
    },
    environmentConcept: { setting, worldType: input.refinement.realism === "realistic" ? "realistic" : input.refinement.realism === "abstract" ? "abstract" : input.refinement.realism === "mixed" ? "hybrid" : "surreal", description: `${setting}, designed as one continuous world whose regions embody the song's changing emotional pressure.` },
    spatialQualities: { scale, openness: instrumental ? 0.86 : 0.64, isolation: 0.72, verticality: input.refinement.scale === "vast" ? 0.84 : 0.65, density: obscure ? 0.72 : 0.48, navigationalClarity: 0.74, distortion: input.refinement.realism === "abstract" ? 0.82 : input.refinement.realism === "surreal" ? 0.66 : 0.32 },
    palette: obscure
      ? { primaryColors: ["smoked glass", "deep pine", "oxidized iron"], accentColors: ["amber sap", "cold electric blue"], warmth: 0.38, saturation: 0.48, brightness: 0.45, contrast: 0.72 }
      : { primaryColors: ["chalk limestone", "blue-grey shadow", "weathered silver"], accentColors: ["honeyed amber", "soft dawn gold"], warmth: 0.52, saturation: 0.35, brightness: 0.62, contrast: 0.68 },
    atmosphere: { weather: "still air giving way to a broad crosswind", fog: 0.32, wind: 0.45, particulateDensity: 0.28, environmentalMotion: 0.38, visibility: 0.78 },
    symbolicElements: obscure
      ? [{ object: "glass-bearing trees", meaning: "Fragility that remains alive", placement: "repeated along the primary traversable route", prominence: 0.9 }, { object: "silent stamping press", meaning: "Pressure held in suspension", placement: "central landmark at the climax chamber", prominence: 0.82 }]
      : [{ object: "luminous interior threshold", meaning: "Belonging visible across uncertainty", placement: "persistent landmark visible from most regions", prominence: 0.95 }, { object: "broken measuring walls", meaning: "Standards that once made the traveler feel too small", placement: "oversized structures surrounding the middle path", prominence: 0.75 }],
    architecture: { style: obscure ? "botanical industrialism" : "monolithic sacred minimalism without religious iconography", materialLanguage: obscure ? ["smoked glass", "dark steel", "living wood", "amber resin"] : ["pale limestone", "brushed metal", "translucent mineral", "warm interior plaster"], scaleBehavior: `Begins human-scaled, becomes ${input.refinement.scale} at the emotional peak, then settles into legible proportions.`, transformationBehavior: "Use persistent changes in material transparency and structural openness; reserve timed animation for a later interactive phase." },
    journey: { startingSpace: "A sheltered, acoustically implied antechamber with one distant landmark visible through a narrow opening.", development: "A connected path crosses repeating structures that gradually widen and reveal alternate routes without losing orientation.", climaxSpace: obscure ? "A vast glasshouse-machine hall where the primary organic and industrial systems meet." : "An exposed monumental basin beneath the persistent illuminated threshold, with oversized walls falling away from the path.", endingSpace: "A quieter elevated terrace that visually reconnects every traversed region and leaves the central landmark reachable but not over-explained." },
  };
}

function buildWorldPrompt(input: GenerateRequest, interpretation: SongInterpretation, spatial: SpatialInterpretation, confidence: SongWorldAnalysis["confidence"], weights: SongWorldAnalysis["weights"]): WorldPrompt {
  const symbols = spatial.symbolicElements.map((item) => `${item.object} (${item.meaning.toLowerCase()})`).join(" and ");
  const prompt = `Create a coherent explorable 3D environment titled “${spatial.centralSpatialMetaphor.concept}.” Build ${spatial.environmentConcept.description} The world must be a navigable space made of connected areas with strong spatial continuity, multiple viewpoints, a clear walkable or traversable path, and a persistent landmark that maintains orientation.\n\nSPATIAL LAYOUT: Begin in ${spatial.journey.startingSpace} The foreground should use close, tactile ${spatial.architecture.materialLanguage.slice(0, 2).join(" and ")} surfaces. The midground develops through ${spatial.journey.development} The background must keep the central destination visible across changing elevation and partial occlusion. The climax occupies ${spatial.journey.climaxSpace} End in ${spatial.journey.endingSpace}\n\nVISUAL LANGUAGE: Use ${spatial.architecture.style} with consistent ${spatial.architecture.materialLanguage.join(", ")}. ${spatial.architecture.scaleBehavior} Use a palette of ${spatial.palette.primaryColors.join(", ")} with controlled accents of ${spatial.palette.accentColors.join(" and ")}. Lighting moves spatially from cool indirect ambient light in the opening region toward warmer volumetric illumination near the destination, while remaining persistent rather than time-synchronized. Atmosphere should provide depth through restrained fog, sparse particulate matter, and visible wind-shaped surfaces without obscuring navigation.\n\nSYMBOLIC SYSTEM: Limit the world to a few legible recurring elements: ${symbols}. Their placement must guide movement and clarify meaning through spatial function, not text labels. Express “${interpretation.coreThemes[0]?.name}” through changes in accessibility, distance, enclosure, and scale rather than literal illustration.\n\nMUSICAL REGIONS: Give each major song section a durable area in the same world. The opening is sparse and sheltered; developing sections introduce repetition and narrower passages; the highest-intensity section opens into the largest, most exposed region; the ending revisits earlier materials in a calmer, more comprehensible arrangement. Connect every region physically so the result reads as one explorable place, not separate tableaux. Preserve consistent architecture, terrain logic, landmark placement, and material behavior throughout.\n\nBASE-WORLD CONSTRAINT: Generate only the static or persistent base environment. Design clear zones where future music-synchronized lighting, particles, distortion, and structural motion could occur, but do not assume those timed systems exist. No single-view composition; support movement, return paths, alternate viewpoints, and readable foreground, midground, and background.`;
  return {
    title: spatial.centralSpatialMetaphor.concept,
    oneSentenceConcept: spatial.environmentConcept.description,
    interpretationSummary: interpretation.summary,
    prompt,
    negativePrompt: "No text, lyrics, signage, logos, recognizable people, living-artist style imitation, trademarked fictional settings, music-video recreation, disconnected dioramas, single-view composition, impossible non-navigable geometry, excessive unrelated symbols, or assumed timed animation.",
    scenePlan: { worldType: spatial.environmentConcept.worldType, setting: spatial.environmentConcept.setting, emotionalTone: interpretation.emotionalArc.map((arc) => arc.emotionalState).filter((value, index, all) => all.indexOf(value) === index), centralLandmark: spatial.symbolicElements[0]?.object ?? "persistent illuminated threshold", startingArea: spatial.journey.startingSpace, middleArea: spatial.journey.development, climaxArea: spatial.journey.climaxSpace, endingArea: spatial.journey.endingSpace },
    generationGuidance: { preserveSpatialContinuity: true, emphasizeNavigability: true, avoidSingleViewComposition: true, avoidTextInEnvironment: true, avoidRecognizablePeople: true },
    confidence, evidenceWeights: weights,
    limitations: ["Development mode uses curated fixtures rather than live recognition, licensed lyrics, or acoustic feature extraction.", "The prompt defines a persistent base world; later systems must add timing, camera behavior, and audio reactivity.", ...(input.fixtureId === "instrumental" ? ["No reliable lyrics or external context were available; semantic claims are intentionally limited."] : [])],
  };
}

export async function runAnalysis(input: GenerateRequest): Promise<SongWorldAnalysis> {
  const title = input.confirmed.title || input.identification.title;
  const artist = input.confirmed.artist || input.identification.artist;
  const [lyrics, context, music] = await Promise.all([
    providers.lyrics.findLyrics({ title, artist, manualLyrics: input.manualLyrics, fixtureId: input.fixtureId }),
    providers.context.research({ title, artist, manualContext: input.manualContext, fixtureId: input.fixtureId }),
    providers.music.analyze({ fixtureId: input.fixtureId }),
  ]);
  const confidence = calculateConfidence({ identification: input.identification.confidence, lyrics: lyrics.confidence, music: music.confidence.emotionalFeatures, contextCount: contextCount(context), artistStatementCount: context.artistStatements.length, transcription: lyrics.sourceKind === "transcription" ? lyrics.confidence : 0 });
  const hasGuidance = Boolean(input.personalInterpretation || input.emphasisNote || input.refinement.userNote);
  const weights = calculateEvidenceWeights(confidence, hasGuidance, input.refinement.balance);
  const level = fallbackLevel(confidence);
  const interpretation = buildInterpretation(input, music, lyrics, level);
  const spatialInterpretation = buildSpatial(input);
  const worldPrompt = buildWorldPrompt(input, interpretation, spatialInterpretation, confidence, weights);
  const base = songWorldAnalysisSchema.parse({
    song: { identification: input.identification, confirmedTitle: title, confirmedArtist: artist }, lyrics, context, music, confidence, weights, interpretation, spatialInterpretation, worldPrompt, fallbackLevel: level,
    evidenceSummary: [
      { label: "Song identity", available: confidence.songIdentification > 0.4, confidence: confidence.songIdentification, detail: confidence.songIdentification > 0.4 ? `${title || "Untitled"} — ${artist || "Unknown artist"}` : "No reliable match; using audio and guidance" },
      { label: "Lyrics", available: lyrics.available, confidence: lyrics.confidence, detail: lyrics.displayNotice },
      { label: "Musical structure", available: true, confidence: confidence.musicalAnalysis, detail: `${music.sections.length} sections · ${music.tempoBpm ?? "Unknown"} BPM · ${music.mode} mode` },
      { label: "External context", available: contextCount(context) > 0, confidence: confidence.externalContext, detail: contextCount(context) ? `${contextCount(context)} curated evidence item${contextCount(context) === 1 ? "" : "s"}` : "No reliable commentary found" },
    ],
  });
  return songWorldAnalysisSchema.parse(await enhanceWithOpenAI(base, input));
}

export function compactAnalysisForAI(analysis: SongWorldAnalysis) {
  return { title: analysis.song.confirmedTitle, artist: analysis.song.confirmedArtist, evidenceWeights: Object.fromEntries(Object.entries(analysis.weights).map(([key, value]) => [key, `${pct(value)}%`])), summary: analysis.interpretation.summary };
}
