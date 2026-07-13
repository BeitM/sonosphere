import type { LyricsLookup, MusicalAnalysis, SongContext, SongIdentification } from "@/lib/schemas";

export type FixtureId = "known" | "obscure" | "instrumental";
export type Fixture = { id: FixtureId; label: string; description: string; identification: SongIdentification; lyrics: LyricsLookup; context: SongContext; music: MusicalAnalysis };

const emptyContext: SongContext = { artistStatements: [], factualBackground: [], publishedInterpretations: [], commonInterpretations: [] };

export const fixtures: Record<FixtureId, Fixture> = {
  known: {
    id: "known", label: "Known lyrical work", description: "Strong identity, public-domain lyrics, and rich context",
    identification: { title: "Amazing Grace", artist: "Traditional", album: "Public-domain hymn", releaseYear: 1779, confidence: 0.98, provider: "Sonicprint Mock", alternatives: [{ title: "Amazing Grace", artist: "Traditional", confidence: 0.98 }] },
    lyrics: { available: true, lyrics: "Amazing grace, how sweet the sound / That saved a wretch like me / I once was lost, but now am found / Was blind, but now I see", source: "Public-domain fixture", sourceKind: "public_domain", licensed: true, confidence: 0.99, displayNotice: "Public-domain excerpt supplied by the development fixture." },
    context: {
      artistStatements: [],
      factualBackground: [{ summary: "Written by John Newton and first published in 1779, the hymn frames moral transformation through the contrast between being lost and found.", sourceTitle: "Public-domain development context", sourceType: "official_source", reliability: 0.92 }],
      publishedInterpretations: [{ summary: "The familiar reading emphasizes personal transformation, humility, rescue, and the difficult movement from blindness toward perception.", sourceTitle: "Curated mock research summary", sourceType: "publication", reliability: 0.82 }],
      commonInterpretations: [{ summary: "Often understood as a passage from estrangement into belonging rather than a simple arrival at happiness.", sourceTitle: "Common interpretation fixture", sourceType: "community", reliability: 0.66 }],
    },
    music: {
      durationSeconds: 234, tempoBpm: 72, key: "G", mode: "major", provider: "Resonance Mock Analyzer",
      overall: { energy: 0.46, valence: 0.58, tension: 0.38, brightness: 0.55, density: 0.3, rhythmicIntensity: 0.2, vocalProminence: 0.88, dynamicRange: 0.72 },
      sections: [
        { id: "intro", label: "intro", startTime: 0, endTime: 22, energy: 0.2, tension: 0.25, loudness: 0.22, brightness: 0.38, rhythmicIntensity: 0.1, vocalIntensity: 0.05, description: "Sparse opening with generous silence." },
        { id: "verse-a", label: "verse", startTime: 22, endTime: 92, energy: 0.38, tension: 0.4, loudness: 0.42, brightness: 0.48, rhythmicIntensity: 0.18, vocalIntensity: 0.74, description: "A restrained statement that holds vulnerability close." },
        { id: "verse-b", label: "verse", startTime: 92, endTime: 170, energy: 0.58, tension: 0.48, loudness: 0.62, brightness: 0.6, rhythmicIntensity: 0.25, vocalIntensity: 0.9, description: "Harmony widens and the voice reaches its emotional peak." },
        { id: "outro", label: "outro", startTime: 170, endTime: 234, energy: 0.36, tension: 0.18, loudness: 0.38, brightness: 0.66, rhythmicIntensity: 0.12, vocalIntensity: 0.55, description: "The intensity recedes without losing the newly gained openness." },
      ],
      notableMoments: [{ time: 128, type: "vocal_peak", intensity: 0.88, description: "The melody reaches its broadest register as the harmony opens." }, { time: 205, type: "texture_change", intensity: 0.56, description: "The arrangement thins into a luminous final space." }],
      confidence: { tempo: 0.91, key: 0.86, sectionDetection: 0.84, emotionalFeatures: 0.78 },
    },
  },
  obscure: {
    id: "obscure", label: "Obscure lyrical song", description: "Lyrics are available, but commentary is intentionally sparse",
    identification: { title: "Glass Orchard", artist: "Mara Venn", album: "Small Weather", releaseYear: 2024, confidence: 0.78, provider: "Sonicprint Mock", alternatives: [{ title: "Glass Orchard", artist: "Mara Venn", confidence: 0.78 }, { title: "Orchard Glass", artist: "Venn", confidence: 0.41 }] },
    lyrics: { available: true, lyrics: "Fabricated fixture text about tending a transparent orchard, preserving fragile fruit, and hearing distant machinery beyond the trees.", source: "Fabricated development fixture", sourceKind: "licensed", licensed: true, confidence: 0.86, displayNotice: "Fabricated test lyrics; safe to display in development." },
    context: { ...emptyContext, factualBackground: [{ summary: "A small independent release with no verified artist commentary in the mock research index.", sourceTitle: "Mock catalog metadata", sourceType: "official_source", reliability: 0.72 }] },
    music: {
      durationSeconds: 198, tempoBpm: 104, key: "D minor", mode: "minor", provider: "Resonance Mock Analyzer",
      overall: { energy: 0.61, valence: 0.35, tension: 0.68, brightness: 0.48, density: 0.66, rhythmicIntensity: 0.62, vocalProminence: 0.7, dynamicRange: 0.58 },
      sections: [
        { id: "intro", label: "intro", startTime: 0, endTime: 18, energy: 0.24, tension: 0.45, loudness: 0.3, brightness: 0.65, rhythmicIntensity: 0.22, vocalIntensity: 0, description: "Brittle plucked tones establish a precise, uneasy texture." },
        { id: "verse", label: "verse", startTime: 18, endTime: 72, energy: 0.48, tension: 0.62, loudness: 0.5, brightness: 0.52, rhythmicIntensity: 0.5, vocalIntensity: 0.68, description: "Close vocal over a tightening mechanical pulse." },
        { id: "chorus", label: "chorus", startTime: 72, endTime: 124, energy: 0.82, tension: 0.78, loudness: 0.85, brightness: 0.46, rhythmicIntensity: 0.8, vocalIntensity: 0.9, description: "Dense percussion presses against an unexpectedly delicate melody." },
        { id: "bridge", label: "bridge", startTime: 124, endTime: 158, energy: 0.35, tension: 0.72, loudness: 0.34, brightness: 0.3, rhythmicIntensity: 0.2, vocalIntensity: 0.45, description: "The beat drops away, leaving suspended harmonic tension." },
        { id: "outro", label: "outro", startTime: 158, endTime: 198, energy: 0.7, tension: 0.58, loudness: 0.72, brightness: 0.62, rhythmicIntensity: 0.75, vocalIntensity: 0.58, description: "The machinery returns, but the fragile motif remains audible." },
      ],
      notableMoments: [{ time: 73, type: "drop", intensity: 0.9, description: "Percussion and low texture enter together." }, { time: 125, type: "sudden_silence", intensity: 0.78, description: "Rhythmic motion collapses into suspended air." }],
      confidence: { tempo: 0.88, key: 0.72, sectionDetection: 0.75, emotionalFeatures: 0.71 },
    },
  },
  instrumental: {
    id: "instrumental", label: "Unknown instrumental", description: "No reliable identity or lyrics; interpretation follows sound and guidance",
    identification: { confidence: 0.08, provider: "Sonicprint Mock", alternatives: [] },
    lyrics: { available: false, sourceKind: "unavailable", licensed: false, confidence: 0, displayNotice: "No lyrics were found and no transcription was attempted." },
    context: emptyContext,
    music: {
      durationSeconds: 286, tempoBpm: 118, mode: "mixed", provider: "Resonance Mock Analyzer",
      overall: { energy: 0.72, valence: 0.46, tension: 0.74, brightness: 0.57, density: 0.78, rhythmicIntensity: 0.73, vocalProminence: 0, dynamicRange: 0.83 },
      sections: [
        { id: "opening", label: "intro", startTime: 0, endTime: 46, energy: 0.18, tension: 0.44, loudness: 0.2, brightness: 0.34, rhythmicIntensity: 0.12, vocalIntensity: 0, description: "A distant low drone with isolated metallic overtones." },
        { id: "current", label: "instrumental", startTime: 46, endTime: 132, energy: 0.58, tension: 0.66, loudness: 0.6, brightness: 0.54, rhythmicIntensity: 0.65, vocalIntensity: 0, description: "Layered pulses establish forward motion without a stable destination." },
        { id: "surge", label: "instrumental", startTime: 132, endTime: 222, energy: 0.96, tension: 0.91, loudness: 0.94, brightness: 0.78, rhythmicIntensity: 0.92, vocalIntensity: 0, description: "A wide, turbulent climax with competing rhythmic layers." },
        { id: "after", label: "outro", startTime: 222, endTime: 286, energy: 0.28, tension: 0.35, loudness: 0.3, brightness: 0.44, rhythmicIntensity: 0.18, vocalIntensity: 0, description: "The pulse dissolves, leaving a quieter but altered harmonic field." },
      ],
      notableMoments: [{ time: 138, type: "crescendo", intensity: 0.97, description: "All layers expand into the track's largest dynamic field." }, { time: 224, type: "texture_change", intensity: 0.86, description: "Dense rhythm gives way to resonant decay." }],
      confidence: { tempo: 0.81, key: 0.38, sectionDetection: 0.7, emotionalFeatures: 0.73 },
    },
  },
};

export function fixtureFor(id?: string) { return fixtures[(id as FixtureId) in fixtures ? id as FixtureId : "known"]; }
