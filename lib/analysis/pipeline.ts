import { providersFor } from "@/lib/providers/registry";
import { songWorldAnalysisSchema, type GenerateRequest, type LyricsLookup, type MusicalAnalysis, type SongContext, type SongInterpretation, type SongWorldAnalysis, type SpatialInterpretation, type WorldPrompt } from "@/lib/schemas";
import { calculateConfidence, calculateEvidenceWeights, fallbackLevel } from "./weights";
import { enhanceWithOpenAI } from "@/lib/ai/openai";
import { buildMarblePrompt, normalizeWorldPrompt } from "./world-prompts";
import { buildAdaptiveJourney } from "./spatial-journey";

const pct = (n: number) => Math.round(n * 100);
const clamp = (n: number) => Math.min(1, Math.max(0, n));
const contextCount = (context: SongContext) => Object.values(context).flat().length;

function buildInterpretation(input: GenerateRequest, music: MusicalAnalysis, lyrics: LyricsLookup, level: number): SongInterpretation {
  const hasWords = lyrics.available;
  const guidance = [input.personalInterpretation, input.emphasisNote, input.refinement.userNote].filter(Boolean).join(" ");
  const isKnown = input.useFixture && input.fixtureId === "known";
  const isObscure = input.useFixture && input.fixtureId === "obscure";
  const summary = isKnown
    ? "A passage from estrangement toward belonging, where transformation does not erase vulnerability but makes a wider world perceptible. The restrained opening and expanding harmony turn recognition into a physical sense of space opening around the listener."
    : isObscure
      ? "A meditation on protecting something delicate inside systems built for pressure and repetition. Fragility is not presented as weakness: the musical climax lets the mechanical and organic coexist without resolving their tension."
      : input.useFixture
        ? "An instrumental journey from isolation into turbulent collective motion, followed by a changed stillness. With no reliable lyrics or identity, the interpretation rests on density, rhythm, dynamic contrast, and the listener's guidance."
        : `A sound-led interpretation of a ${music.mode} recording at ${music.tempoBpm ? `${Math.round(music.tempoBpm)} BPM` : "an uncertain tempo"}. Its ${music.overall.dynamicRange > 0.65 ? "wide" : "restrained"} dynamic range and changing section energy define the movement from the opening through the highest-intensity region and into the ending.`;
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
      : input.useFixture
        ? [
            { name: "Accumulation and release", description: "Layered rhythm converts empty distance into overwhelming motion before dissolving.", confidence: 0.84, evidenceSources: ["music"] },
            { name: "Changed return", description: "The ending resembles the opening but carries the resonance of the climax.", confidence: 0.77, evidenceSources: ["music", "ai_inference"] },
          ]
        : [
            { name: "Dynamic transformation", description: `The recording moves through ${music.sections.length} detected regions whose energy and tension create the primary narrative shape.`, confidence: music.confidence.sectionDetection, evidenceSources: ["music"] },
            { name: `${music.mode === "minor" ? "Tonal tension" : music.mode === "major" ? "Tonal openness" : "Tonal ambiguity"}`, description: `The detected ${music.key ? `${music.key} ` : ""}${music.mode} center and ${music.overall.brightness > 0.55 ? "bright" : "muted"} spectrum establish the atmosphere without implying creator intent.`, confidence: Math.max(0.35, music.confidence.key), evidenceSources: ["music", "ai_inference"] },
          ];
  if (guidance) themes.push({ name: "Listener emphasis", description: `User guidance suggests: ${guidance}`, confidence: 0.62, evidenceSources: ["user_guidance"] });
  return {
    summary,
    coreThemes: themes.map((theme) => ({ ...theme, evidenceSources: [...theme.evidenceSources] })),
    emotionalConflicts: isObscure
      ? [{ sideA: "Protection", sideB: "Transformation", explanation: "The same enclosure that shelters the delicate orchard can also prevent it from living." }]
      : !input.useFixture
        ? [{ sideA: "Restraint", sideB: "Release", explanation: "Measured changes in section energy, tension, and dynamic range create a contrast between enclosure and expansion without assigning a lyrical meaning." }]
      : [{ sideA: level === 4 ? "Solitude" : "Estrangement", sideB: level === 4 ? "Collective motion" : "Belonging", explanation: "The song makes the desired state perceptible before it becomes reachable." }],
    narrativePerspective: hasWords
      ? input.useFixture ? "An intimate first-person witness moving through remembered limitation toward an altered understanding." : "A lyrical perspective is present in user-supplied text; detailed narrative claims depend on live semantic analysis."
      : "A non-verbal environmental perspective inferred from musical motion.",
    recurringImages: isObscure
      ? [{ image: "transparent fruit", meaning: "Care made visible and therefore vulnerable", confidence: 0.82 }, { image: "distant machinery", meaning: "Pressure that is structural rather than villainous", confidence: 0.72 }]
      : isKnown
        ? [{ image: "a distant illuminated threshold", meaning: "Belonging that can be perceived before it can be entered", confidence: 0.86 }, { image: "surfaces becoming translucent", meaning: "Perception replacing certainty", confidence: 0.76 }]
        : input.useFixture
          ? [{ image: "converging currents", meaning: "Independent pulses becoming a shared force", confidence: 0.78 }]
          : [{ image: "connected regions of changing scale", meaning: "Measured changes in musical energy translated into spatial pressure", confidence: music.confidence.emotionalFeatures }],
    musicLyricsRelationship: {
      type: hasWords && input.useFixture ? "evolving" : "unclear",
      explanation: hasWords
        ? input.useFixture ? "The arrangement begins smaller than the language's promise, then spatially expands until the musical world can hold that promise." : "The acoustic structure and supplied lyrics remain separate evidence in the deterministic fallback; live semantic analysis may establish their relationship without assuming alignment."
        : "No reliable lyric evidence is available; the arc is inferred only from musical structure.",
    },
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

function buildSpatial(input: GenerateRequest, music: MusicalAnalysis): SpatialInterpretation {
  const obscure = input.useFixture && input.fixtureId === "obscure";
  const instrumental = input.useFixture && input.fixtureId === "instrumental";
  const realUpload = !input.useFixture;
  const journey = buildAdaptiveJourney(music);
  const adaptiveSettings: Record<typeof journey.topology, string> = {
    linear: "a continuous precinct organized around a materially evolving route",
    looping: "a circuit of linked courts and passages that returns to shared ground",
    branching: "a connected precinct of contrasting routes that divide and reconvene",
    radial: "a navigable hub-and-ring environment with repeated structural intervals",
    layered: "a single site made of adjacent spatial conditions joined along a shared seam",
    distributed: "an open field of intervisible places connected by overlapping paths",
  };
  const adaptiveMetaphors: Record<typeof journey.topology, { concept: string; explanation: string }> = {
    linear: { concept: "A route transformed by sustained musical direction", explanation: "Measured change becomes a continuous spatial evolution rather than a prescribed rise toward a climax." },
    looping: { concept: "A return that makes familiar ground feel changed", explanation: "The relationship between opening, intervening contrast, and ending becomes a circuit with accumulated viewpoints." },
    branching: { concept: "Contrasting musical forces carried by equally valid paths", explanation: "Detected regions become routes that can be compared and recombined instead of ranked as a single dramatic sequence." },
    radial: { concept: "A pulse distributed around a shared center", explanation: "Rhythm and density organize repeated intervals, rings, and offsets without requiring one dominant destination." },
    layered: { concept: "Contrasting musical conditions held beside one another", explanation: "Dynamic changes become neighboring spatial layers whose tension is perceived through crossings and simultaneous views." },
    distributed: { concept: "A field whose emphasis moves between related places", explanation: "Subtle acoustic variation becomes changing proximity, texture, and attention without a singular climax." },
  };
  const setting = input.refinement.worldType !== "auto" ? `${input.refinement.worldType} environment with a ${journey.topology} spatial organization` : obscure ? "a transparent orchard threaded through an abandoned precision works" : instrumental ? "a tidal plain of resonant stone and suspended metallic spans" : realUpload ? adaptiveSettings[journey.topology] : "a vast threshold-city carved into pale stone around a luminous inner sanctuary";
  const scale = { intimate: 0.25, human: 0.45, monumental: 0.76, vast: 0.95 }[input.refinement.scale];
  return {
    centralSpatialMetaphor: {
      concept: obscure ? "A living orchard inside an indifferent machine" : instrumental ? "Separate currents gathering into one navigable surge" : realUpload ? adaptiveMetaphors[journey.topology].concept : "A visible sanctuary reached by learning to perceive the path",
      explanation: obscure ? "Organic chambers and mechanical corridors occupy the same structure, turning preservation into a spatial negotiation." : instrumental ? "Paths begin isolated, converge in a turbulent central basin, then separate again with shared resonance." : realUpload ? adaptiveMetaphors[journey.topology].explanation : "Warmth remains visible across distance while walls, scale, and partial transparency change as understanding grows.",
    },
    environmentConcept: { setting, worldType: input.refinement.realism === "realistic" ? "realistic" : input.refinement.realism === "abstract" ? "abstract" : input.refinement.realism === "mixed" ? "hybrid" : "surreal", description: `${setting}, designed as one continuous world whose regions embody the song's changing emotional pressure.` },
    spatialQualities: { scale, openness: realUpload ? clamp(0.4 + music.overall.brightness * 0.35 - music.overall.density * 0.12) : instrumental ? 0.86 : 0.64, isolation: realUpload ? clamp(0.78 - music.overall.energy * 0.32) : 0.72, verticality: realUpload ? clamp(0.42 + music.overall.dynamicRange * 0.45) : input.refinement.scale === "vast" ? 0.84 : 0.65, density: realUpload ? music.overall.density : obscure ? 0.72 : 0.48, navigationalClarity: 0.74, distortion: input.refinement.realism === "abstract" ? 0.82 : input.refinement.realism === "surreal" ? 0.66 : 0.32 },
    palette: obscure
      ? { primaryColors: ["smoked glass", "deep pine", "oxidized iron"], accentColors: ["amber sap", "cold electric blue"], warmth: 0.38, saturation: 0.48, brightness: 0.45, contrast: 0.72 }
      : { primaryColors: ["chalk limestone", "blue-grey shadow", "weathered silver"], accentColors: ["honeyed amber", "soft dawn gold"], warmth: realUpload ? music.overall.valence : 0.52, saturation: realUpload ? clamp(0.2 + music.overall.energy * 0.35) : 0.35, brightness: realUpload ? music.overall.brightness : 0.62, contrast: realUpload ? clamp(0.35 + music.overall.dynamicRange * 0.5) : 0.68 },
    atmosphere: { weather: realUpload && music.overall.energy > 0.7 ? "pressurized crosswinds moving through exposed passages" : "still air giving way to a broad crosswind", fog: realUpload ? clamp(0.5 - music.overall.brightness * 0.3) : 0.32, wind: realUpload ? music.overall.rhythmicIntensity : 0.45, particulateDensity: realUpload ? clamp(music.overall.density * 0.45) : 0.28, environmentalMotion: realUpload ? music.overall.rhythmicIntensity : 0.38, visibility: realUpload ? clamp(0.58 + music.overall.brightness * 0.32) : 0.78 },
    symbolicElements: obscure
      ? [{ object: "glass-bearing trees", meaning: "Fragility that remains alive", placement: "repeated along the primary traversable route", prominence: 0.9 }, { object: "silent stamping press", meaning: "Pressure held in suspension", placement: "central landmark at the climax chamber", prominence: 0.82 }]
      : realUpload
        ? [{ object: "persistent orientation element", meaning: "Continuity across musical change", placement: journey.orientationStrategy, prominence: 0.9 }, { object: "recurring resonant boundary", meaning: "Measured musical difference", placement: "repeated with controlled variation across connected areas", prominence: 0.72 }]
      : [{ object: "luminous interior threshold", meaning: "Belonging visible across uncertainty", placement: "persistent landmark visible from most regions", prominence: 0.95 }, { object: "broken measuring walls", meaning: "Standards that once made the traveler feel too small", placement: "oversized structures surrounding the middle path", prominence: 0.75 }],
    architecture: { style: obscure ? "botanical industrialism" : realUpload ? "acoustically derived architecture" : "monolithic sacred minimalism without religious iconography", materialLanguage: obscure ? ["smoked glass", "dark steel", "living wood", "amber resin"] : ["pale limestone", "brushed metal", "translucent mineral", "warm interior plaster"], scaleBehavior: `Keep the entire environment at the selected ${input.refinement.scale} scale; express emotional intensity through enclosure, exposure, light, repetition, and distance without changing that geometric scale.`, transformationBehavior: journey.transformationLogic },
    journey,
  };
}

function buildWorldPrompt(input: GenerateRequest, music: MusicalAnalysis, lyrics: LyricsLookup, interpretation: SongInterpretation, spatial: SpatialInterpretation, confidence: SongWorldAnalysis["confidence"], weights: SongWorldAnalysis["weights"]): WorldPrompt {
  const symbols = spatial.symbolicElements.map((item) => `${item.object} (${item.meaning.toLowerCase()})`).join(" and ");
  const areas = spatial.journey.areas.map((area) => `${area.name} [${area.role}]: ${area.description} Connect it to ${area.connections.join(" and ")}.`).join(" ");
  const acousticFoundation = `ACOUSTIC FOUNDATION: Shape region spacing around the measured ${music.tempoBpm ? `${Math.round(music.tempoBpm)} BPM pulse` : "uncertain pulse"} and ${music.key ? `${music.key} ` : ""}${music.mode} tonal center. Reflect measured ${music.overall.dynamicRange > 0.65 ? "wide" : "restrained"} dynamics, ${music.overall.brightness > 0.55 ? "bright" : "muted"} spectral character, and ${music.overall.density > 0.6 ? "dense" : "open"} texture through persistent scale, light, material, and enclosure—not timed animation.`;
  const prompt = `Create a coherent explorable 3D environment titled “${spatial.centralSpatialMetaphor.concept}.” Build ${spatial.environmentConcept.description} The world must be navigable from multiple viewpoints with physically connected areas and a readable orientation system.\n\nSPATIAL ORGANIZATION: Use a ${spatial.journey.topology} topology. ${spatial.journey.transformationLogic} Entry experience: ${spatial.journey.entryExperience} ${areas} Orientation: ${spatial.journey.orientationStrategy}\n\nVISUAL LANGUAGE: Use ${spatial.architecture.style} with consistent ${spatial.architecture.materialLanguage.join(", ")}. ${spatial.architecture.scaleBehavior} Use a palette of ${spatial.palette.primaryColors.join(", ")} with controlled accents of ${spatial.palette.accentColors.join(" and ")}. Distribute persistent light according to the topology and musical evidence rather than assuming a cool opening and warm destination. Atmosphere should provide readable depth without obscuring navigation.\n\nSYMBOLIC SYSTEM: Limit the world to a few legible recurring elements: ${symbols}. Their placement must guide movement and clarify meaning through spatial function, not text labels. Express “${interpretation.coreThemes[0]?.name}” through accessibility, sightlines, thresholds, proximity, material contrast, and spatial pressure rather than literal illustration.\n\nMUSICAL REGIONS: Translate detected acoustic differences through the chosen topology. Regions may loop, branch, coexist, radiate, accumulate, disperse, or change emphasis; do not assume that greater intensity means greater size, height, openness, or narrative importance. Preserve consistent scale, construction, terrain logic, and material behavior throughout.\n\nBASE-WORLD CONSTRAINT: Generate only the static or persistent base environment. Design clear zones where future music-synchronized lighting, particles, distortion, and structural motion could occur, but do not assume those timed systems exist. No single-view composition; support free exploration, alternate viewpoints, and readable foreground, midground, and background.`;
  return normalizeWorldPrompt({
    title: spatial.centralSpatialMetaphor.concept,
    oneSentenceConcept: spatial.environmentConcept.description,
    interpretationSummary: interpretation.summary,
    prompt: input.useFixture ? prompt : prompt.replace("\n\nSPATIAL ORGANIZATION:", `\n\n${acousticFoundation}\n\nSPATIAL ORGANIZATION:`),
    marblePrompt: buildMarblePrompt(input.refinement, interpretation, spatial),
    negativePrompt: "No text, lyrics, signage, logos, recognizable people, living-artist style imitation, trademarked fictional settings, music-video recreation, disconnected dioramas, single-view composition, impossible non-navigable geometry, excessive unrelated symbols, or assumed timed animation.",
    scenePlan: { worldType: spatial.environmentConcept.worldType, setting: spatial.environmentConcept.setting, emotionalTone: interpretation.emotionalArc.map((arc) => arc.emotionalState).filter((value, index, all) => all.indexOf(value) === index), centralLandmark: spatial.symbolicElements[0]?.object ?? "persistent orientation element", topology: spatial.journey.topology, transformationLogic: spatial.journey.transformationLogic, areas: spatial.journey.areas, orientationStrategy: spatial.journey.orientationStrategy },
    generationGuidance: { preserveSpatialContinuity: true, emphasizeNavigability: true, avoidSingleViewComposition: true, avoidTextInEnvironment: true, avoidRecognizablePeople: true },
    confidence, evidenceWeights: weights,
    limitations: [input.useFixture ? "Development mode uses curated fixtures rather than live recognition, licensed lyrics, or acoustic feature extraction." : "Musical features were extracted from the uploaded recording; semantic conclusions remain an interpretive synthesis rather than creator intent.", "The prompt defines a persistent base world; later systems must add timing, camera behavior, and audio reactivity.", ...(!input.useFixture && !lyrics.available ? ["No reliable lyrics were available; the interpretation is primarily sound-led."] : []), ...(input.useFixture && input.fixtureId === "instrumental" ? ["No reliable lyrics or external context were available; semantic claims are intentionally limited."] : [])],
  }, spatial.journey.topology);
}

export async function runAnalysis(input: GenerateRequest): Promise<SongWorldAnalysis> {
  const providers = providersFor(input.useFixture);
  const title = input.confirmed.title || input.identification.title;
  const artist = input.confirmed.artist || input.identification.artist;
  const confirmedIdentification = !input.useFixture && title?.trim() && artist?.trim()
    ? { ...input.identification, title: title.trim(), artist: artist.trim(), album: input.confirmed.album || input.identification.album, confidence: 1, provider: "User-confirmed identity", alternatives: [] }
    : input.identification;
  const music = input.musicAnalysis ?? await providers.music.analyze({ fixtureId: input.fixtureId });
  const [lyrics, context] = await Promise.all([
    providers.lyrics.findLyrics({ title, artist, album: input.confirmed.album, durationSeconds: music.durationSeconds, manualLyrics: input.manualLyrics, fixtureId: input.fixtureId }),
    providers.context.research({ title, artist, manualContext: input.manualContext, fixtureId: input.fixtureId }),
  ]);
  const confidence = calculateConfidence({ identification: confirmedIdentification.confidence, lyrics: lyrics.confidence, music: music.confidence.emotionalFeatures, contextCount: contextCount(context), artistStatementCount: context.artistStatements.length, transcription: lyrics.sourceKind === "transcription" ? lyrics.confidence : 0 });
  const hasGuidance = Boolean(input.personalInterpretation || input.emphasisNote || input.refinement.userNote);
  const weights = calculateEvidenceWeights(confidence, hasGuidance, input.refinement.balance);
  const level = fallbackLevel(confidence);
  const interpretation = buildInterpretation(input, music, lyrics, level);
  const spatialInterpretation = buildSpatial(input, music);
  const worldPrompt = buildWorldPrompt(input, music, lyrics, interpretation, spatialInterpretation, confidence, weights);
  const base = songWorldAnalysisSchema.parse({
    song: { identification: confirmedIdentification, confirmedTitle: title, confirmedArtist: artist }, lyrics, context, music, confidence, weights, interpretation, spatialInterpretation, worldPrompt, fallbackLevel: level,
    evidenceSummary: [
      { label: "Song identity", available: confidence.songIdentification > 0.4, confidence: confidence.songIdentification, detail: confidence.songIdentification > 0.4 ? `${title || "Untitled"} — ${artist || "Unknown artist"}` : "No reliable match; using audio and guidance" },
      { label: "Lyrics", available: lyrics.available, confidence: lyrics.confidence, detail: lyrics.displayNotice },
      { label: "Musical structure", available: true, confidence: confidence.musicalAnalysis, detail: `${music.sections.length} acoustic regions · ${music.tempoBpm ? Math.round(music.tempoBpm) : "Unknown"} BPM · ${music.mode} mode` },
      { label: "External context", available: contextCount(context) > 0, confidence: confidence.externalContext, detail: contextCount(context) ? `${contextCount(context)} curated evidence item${contextCount(context) === 1 ? "" : "s"}` : "No reliable commentary found" },
    ],
  });
  return songWorldAnalysisSchema.parse(await enhanceWithOpenAI(base, input));
}

export function compactAnalysisForAI(analysis: SongWorldAnalysis) {
  return { title: analysis.song.confirmedTitle, artist: analysis.song.confirmedArtist, evidenceWeights: Object.fromEntries(Object.entries(analysis.weights).map(([key, value]) => [key, `${pct(value)}%`])), summary: analysis.interpretation.summary };
}
