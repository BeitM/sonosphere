import { fixtureFor } from "@/lib/fixtures";
import type { LyricsProvider, MusicAnalysisProvider, SongContextProvider, SongRecognitionProvider } from "./types";

export class MockRecognitionProvider implements SongRecognitionProvider {
  readonly name = "Sonicprint Mock";
  async identifySong(input: Parameters<SongRecognitionProvider["identifySong"]>[0]) {
    const name = input.audio.name.toLowerCase();
    const inferred = name.includes("glass") || name.includes("obscure") ? "obscure" : name.includes("instrument") || name.includes("original") || name.includes("unknown") ? "instrumental" : input.fixtureId;
    const base = structuredClone(fixtureFor(inferred).identification);
    if (input.manualTitle?.trim()) base.title = input.manualTitle.trim();
    if (input.manualArtist?.trim()) base.artist = input.manualArtist.trim();
    return base;
  }
}

export class MockLyricsProvider implements LyricsProvider {
  readonly name = "Rights-aware Mock Lyrics";
  async findLyrics(input: Parameters<LyricsProvider["findLyrics"]>[0]) {
    if (input.manualLyrics?.trim()) return {
      available: true, lyrics: input.manualLyrics.trim(), source: "User-supplied lyrics", sourceKind: "manual" as const,
      licensed: false, confidence: 0.7, displayNotice: "Manually supplied text; accuracy and rights were not independently verified.",
    };
    return structuredClone(fixtureFor(input.fixtureId).lyrics);
  }
}

export class MockContextProvider implements SongContextProvider {
  readonly name = "Curated Context Mock";
  async research(input: Parameters<SongContextProvider["research"]>[0]) {
    const result = structuredClone(fixtureFor(input.fixtureId).context);
    if (input.manualContext?.trim()) result.factualBackground.unshift({
      summary: input.manualContext.trim(), sourceTitle: "User-supplied context", sourceType: "unknown", reliability: 0.55,
    });
    return result;
  }
}

export class MockMusicAnalysisProvider implements MusicAnalysisProvider {
  readonly name = "Resonance Mock Analyzer";
  async analyze(input: Parameters<MusicAnalysisProvider["analyze"]>[0]) {
    return structuredClone(fixtureFor(input.fixtureId).music);
  }
}

export const providers = {
  recognition: new MockRecognitionProvider(),
  lyrics: new MockLyricsProvider(),
  context: new MockContextProvider(),
  music: new MockMusicAnalysisProvider(),
};
