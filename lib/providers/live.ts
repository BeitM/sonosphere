import { musicalAnalysisSchema } from "@/lib/schemas";
import type {
  LyricsProvider,
  MusicAnalysisProvider,
  SongContextProvider,
  SongRecognitionProvider,
} from "./types";

export class ManualRecognitionProvider implements SongRecognitionProvider {
  readonly name = "User-supplied identity";

  async identifySong(input: Parameters<SongRecognitionProvider["identifySong"]>[0]) {
    const title = input.manualTitle?.trim();
    const artist = input.manualArtist?.trim();
    return {
      title: title || undefined,
      artist: artist || undefined,
      confidence: title && artist ? 0.65 : title || artist ? 0.35 : 0.05,
      provider: this.name,
      alternatives: [],
    };
  }
}

export class ManualLyricsProvider implements LyricsProvider {
  readonly name = "User-supplied lyrics";

  async findLyrics(input: Parameters<LyricsProvider["findLyrics"]>[0]) {
    const lyrics = input.manualLyrics?.trim();
    if (lyrics) {
      return {
        available: true,
        lyrics,
        source: "User-supplied lyrics",
        sourceKind: "manual" as const,
        licensed: false,
        confidence: 0.7,
        displayNotice: "User-supplied text; accuracy and rights were not independently verified.",
      };
    }
    return {
      available: false,
      sourceKind: "unavailable" as const,
      licensed: false,
      confidence: 0,
      displayNotice: "No lyrics were supplied. The interpretation is led by the recording and other available evidence.",
    };
  }
}

export class EmptyContextProvider implements SongContextProvider {
  readonly name = "No external context";

  async research(input: Parameters<SongContextProvider["research"]>[0]) {
    const factualBackground = input.manualContext?.trim()
      ? [{ summary: input.manualContext.trim(), sourceTitle: "User-supplied context", sourceType: "unknown" as const, reliability: 0.55 }]
      : [];
    return { artistStatements: [], factualBackground, publishedInterpretations: [], commonInterpretations: [] };
  }
}

export class HttpMusicAnalysisProvider implements MusicAnalysisProvider {
  readonly name = "Sonosphere audio analysis service";

  async analyze(input: Parameters<MusicAnalysisProvider["analyze"]>[0]) {
    if (!input.audio?.bytes) throw new Error("The audio analysis service requires the uploaded audio bytes.");
    const baseUrl = process.env.AUDIO_ANALYSIS_URL?.replace(/\/$/, "");
    if (!baseUrl) throw new Error("AUDIO_ANALYSIS_URL is required when MUSIC_ANALYSIS_PROVIDER=http.");

    const body = new FormData();
    body.append("audio", new Blob([input.audio.bytes], { type: input.audio.type || "application/octet-stream" }), input.audio.name);
    const headers = new Headers();
    if (process.env.AUDIO_ANALYSIS_TOKEN) headers.set("Authorization", `Bearer ${process.env.AUDIO_ANALYSIS_TOKEN}`);

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/analyze`, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(120_000),
      });
    } catch (error) {
      throw new Error(error instanceof Error && error.name === "TimeoutError"
        ? "Audio analysis timed out."
        : "The audio analysis service is unavailable.");
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { detail?: unknown } | null;
      const detail = typeof payload?.detail === "string" ? ` ${payload.detail}` : "";
      throw new Error(`Audio analysis failed with status ${response.status}.${detail}`);
    }
    return musicalAnalysisSchema.parse(await response.json());
  }
}

export class UnconfiguredMusicAnalysisProvider implements MusicAnalysisProvider {
  readonly name = "Unconfigured audio analysis";

  async analyze(): ReturnType<MusicAnalysisProvider["analyze"]> {
    throw new Error("Real audio analysis is not configured. Set MUSIC_ANALYSIS_PROVIDER=http and AUDIO_ANALYSIS_URL, or use a development fixture.");
  }
}
