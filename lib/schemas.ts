import { z } from "zod";

export const normalized = z.number().min(0).max(1);

export const alternativeMatchSchema = z.object({
  title: z.string(),
  artist: z.string(),
  confidence: normalized,
});

export const songIdentificationSchema = z.object({
  title: z.string().optional(),
  artist: z.string().optional(),
  album: z.string().optional(),
  releaseYear: z.number().int().optional(),
  isrc: z.string().optional(),
  confidence: normalized,
  provider: z.string(),
  alternatives: z.array(alternativeMatchSchema).optional(),
});

export const lyricsLookupSchema = z.object({
  available: z.boolean(),
  lyrics: z.string().optional(),
  synchronizedLyrics: z.array(z.object({
    startTime: z.number().nonnegative(),
    endTime: z.number().nonnegative().optional(),
    text: z.string(),
  })).optional(),
  source: z.string().optional(),
  sourceKind: z.enum(["licensed", "public_domain", "manual", "transcription", "unavailable"]),
  licensed: z.boolean(),
  confidence: normalized,
  displayNotice: z.string(),
});

export const evidenceItemSchema = z.object({
  summary: z.string(),
  sourceTitle: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  sourceType: z.enum(["artist_statement", "official_source", "publication", "academic", "community", "unknown"]),
  reliability: normalized,
});

export const songContextSchema = z.object({
  artistStatements: z.array(evidenceItemSchema),
  factualBackground: z.array(evidenceItemSchema),
  publishedInterpretations: z.array(evidenceItemSchema),
  commonInterpretations: z.array(evidenceItemSchema),
});

export const musicalSectionSchema = z.object({
  id: z.string(),
  label: z.enum(["intro", "verse", "pre_chorus", "chorus", "bridge", "instrumental", "breakdown", "outro", "unknown"]),
  startTime: z.number().nonnegative(),
  endTime: z.number().nonnegative(),
  energy: normalized,
  tension: normalized,
  loudness: normalized,
  brightness: normalized,
  rhythmicIntensity: normalized,
  vocalIntensity: normalized,
  description: z.string().optional(),
});

export const notableMomentSchema = z.object({
  time: z.number().nonnegative(),
  type: z.enum(["drop", "crescendo", "sudden_silence", "instrument_entry", "vocal_peak", "key_change", "texture_change", "final_hit", "other"]),
  intensity: normalized,
  description: z.string(),
});

export const musicalAnalysisSchema = z.object({
  durationSeconds: z.number().positive(),
  tempoBpm: z.number().positive().optional(),
  key: z.string().optional(),
  mode: z.enum(["major", "minor", "mixed", "unknown"]),
  overall: z.object({
    energy: normalized,
    valence: normalized,
    tension: normalized,
    brightness: normalized,
    density: normalized,
    rhythmicIntensity: normalized,
    vocalProminence: normalized,
    dynamicRange: normalized,
  }),
  sections: z.array(musicalSectionSchema),
  notableMoments: z.array(notableMomentSchema),
  confidence: z.object({
    tempo: normalized,
    key: normalized,
    sectionDetection: normalized,
    emotionalFeatures: normalized,
  }),
  provider: z.string(),
});

export const analysisConfidenceSchema = z.object({
  songIdentification: normalized,
  lyrics: normalized,
  transcription: normalized,
  musicalAnalysis: normalized,
  externalContext: normalized,
  overallInterpretation: normalized,
});

export const evidenceWeightsSchema = z.object({
  lyrics: normalized,
  music: normalized,
  externalContext: normalized,
  artistStatements: normalized,
  userGuidance: normalized,
});

export const songInterpretationSchema = z.object({
  summary: z.string(),
  coreThemes: z.array(z.object({
    name: z.string(),
    description: z.string(),
    confidence: normalized,
    evidenceSources: z.array(z.enum(["lyrics", "music", "artist_statement", "published_interpretation", "common_interpretation", "user_guidance", "ai_inference"])),
  })),
  emotionalConflicts: z.array(z.object({ sideA: z.string(), sideB: z.string(), explanation: z.string() })),
  narrativePerspective: z.string().optional(),
  recurringImages: z.array(z.object({ image: z.string(), meaning: z.string(), confidence: normalized })),
  musicLyricsRelationship: z.object({
    type: z.enum(["aligned", "contrasting", "evolving", "unclear"]),
    explanation: z.string(),
  }),
  emotionalArc: z.array(z.object({
    sectionId: z.string(),
    emotionalState: z.string(),
    intensity: normalized,
    interpretation: z.string(),
  })),
  uncertaintyNotes: z.array(z.string()),
});

export const spatialInterpretationSchema = z.object({
  centralSpatialMetaphor: z.object({ concept: z.string(), explanation: z.string() }),
  environmentConcept: z.object({
    setting: z.string(),
    worldType: z.enum(["realistic", "surreal", "abstract", "hybrid"]),
    description: z.string(),
  }),
  spatialQualities: z.object({
    scale: normalized,
    openness: normalized,
    isolation: normalized,
    verticality: normalized,
    density: normalized,
    navigationalClarity: normalized,
    distortion: normalized,
  }),
  palette: z.object({
    primaryColors: z.array(z.string()),
    accentColors: z.array(z.string()),
    warmth: normalized,
    saturation: normalized,
    brightness: normalized,
    contrast: normalized,
  }),
  atmosphere: z.object({
    weather: z.string().optional(),
    fog: normalized,
    wind: normalized,
    particulateDensity: normalized,
    environmentalMotion: normalized,
    visibility: normalized,
  }),
  symbolicElements: z.array(z.object({ object: z.string(), meaning: z.string(), placement: z.string(), prominence: normalized })),
  architecture: z.object({
    style: z.string(),
    materialLanguage: z.array(z.string()),
    scaleBehavior: z.string(),
    transformationBehavior: z.string(),
  }),
  journey: z.object({ startingSpace: z.string(), development: z.string(), climaxSpace: z.string(), endingSpace: z.string() }),
});

export const worldPromptSchema = z.object({
  title: z.string(),
  oneSentenceConcept: z.string(),
  interpretationSummary: z.string(),
  prompt: z.string(),
  negativePrompt: z.string().optional(),
  scenePlan: z.object({
    worldType: z.string(),
    setting: z.string(),
    emotionalTone: z.array(z.string()),
    centralLandmark: z.string(),
    startingArea: z.string(),
    middleArea: z.string(),
    climaxArea: z.string(),
    endingArea: z.string(),
  }),
  generationGuidance: z.object({
    preserveSpatialContinuity: z.boolean(),
    emphasizeNavigability: z.boolean(),
    avoidSingleViewComposition: z.boolean(),
    avoidTextInEnvironment: z.boolean(),
    avoidRecognizablePeople: z.boolean(),
  }),
  confidence: analysisConfidenceSchema,
  evidenceWeights: evidenceWeightsSchema,
  limitations: z.array(z.string()),
});

export const refinementSchema = z.object({
  balance: z.enum(["balanced", "lyrics", "music", "context", "personal"]).default("balanced"),
  realism: z.enum(["realistic", "cinematic", "surreal", "abstract", "mixed"]).default("mixed"),
  scale: z.enum(["intimate", "human", "monumental", "vast"]).default("monumental"),
  intensity: z.enum(["restrained", "moderate", "intense", "overwhelming"]).default("intense"),
  worldType: z.enum(["urban", "industrial", "natural", "interior", "cosmic", "dreamlike", "abstract", "auto"]).default("auto"),
  userNote: z.string().max(2000).default(""),
});

export const confirmedSongSchema = z.object({
  title: z.string().max(200).default(""),
  artist: z.string().max(200).default(""),
  album: z.string().max(200).default(""),
});

export const generateRequestSchema = z.object({
  fixtureId: z.enum(["known", "obscure", "instrumental"]).default("known"),
  identification: songIdentificationSchema,
  confirmed: confirmedSongSchema,
  manualLyrics: z.string().max(12000).optional(),
  personalInterpretation: z.string().max(2000).optional(),
  visualPreference: z.string().max(500).optional(),
  emphasisNote: z.string().max(2000).optional(),
  manualContext: z.string().max(4000).optional(),
  refinement: refinementSchema,
});

export const songWorldAnalysisSchema = z.object({
  song: z.object({ identification: songIdentificationSchema, confirmedTitle: z.string().optional(), confirmedArtist: z.string().optional() }),
  lyrics: lyricsLookupSchema,
  context: songContextSchema,
  music: musicalAnalysisSchema,
  confidence: analysisConfidenceSchema,
  weights: evidenceWeightsSchema,
  interpretation: songInterpretationSchema,
  spatialInterpretation: spatialInterpretationSchema,
  worldPrompt: worldPromptSchema,
  fallbackLevel: z.number().int().min(1).max(4),
  evidenceSummary: z.array(z.object({ label: z.string(), available: z.boolean(), confidence: normalized, detail: z.string() })),
});

export type SongIdentification = z.infer<typeof songIdentificationSchema>;
export type LyricsLookup = z.infer<typeof lyricsLookupSchema>;
export type SongContext = z.infer<typeof songContextSchema>;
export type MusicalAnalysis = z.infer<typeof musicalAnalysisSchema>;
export type AnalysisConfidence = z.infer<typeof analysisConfidenceSchema>;
export type EvidenceWeights = z.infer<typeof evidenceWeightsSchema>;
export type SongInterpretation = z.infer<typeof songInterpretationSchema>;
export type SpatialInterpretation = z.infer<typeof spatialInterpretationSchema>;
export type WorldPrompt = z.infer<typeof worldPromptSchema>;
export type Refinement = z.infer<typeof refinementSchema>;
export type GenerateRequest = z.infer<typeof generateRequestSchema>;
export type SongWorldAnalysis = z.infer<typeof songWorldAnalysisSchema>;
