import { z } from "zod";
import type { LyricsLookup } from "@/lib/schemas";
import type { LyricsLookupInput, LyricsProvider } from "./types";
import { ManualLyricsProvider } from "./live";
import { bindRuntimeFetch } from "./runtime-fetch";

const lrclibTrackSchema = z.object({
  id: z.number().int(),
  trackName: z.string(),
  artistName: z.string(),
  albumName: z.string().nullable().optional(),
  duration: z.number().nonnegative(),
  instrumental: z.boolean(),
  plainLyrics: z.string().nullable(),
  syncedLyrics: z.string().nullable(),
});

type LrclibTrack = z.infer<typeof lrclibTrackSchema>;
type Fetcher = typeof fetch;
const lyricCache = new Map<string, { expiresAt: number; result: LyricsLookup }>();
const CACHE_TTL_MS = 15 * 60 * 1_000;

const normalize = (value?: string | null) => (value ?? "")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

function unavailable(displayNotice: string): LyricsLookup {
  return {
    available: false,
    sourceKind: "unavailable",
    licensed: false,
    confidence: 0,
    displayNotice,
  };
}

function matchScore(track: LrclibTrack, input: LyricsLookupInput) {
  if (normalize(track.trackName) !== normalize(input.title) || normalize(track.artistName) !== normalize(input.artist)) return -1;
  let score = 0.84;
  if (input.album && normalize(track.albumName) === normalize(input.album)) score += 0.04;
  if (input.durationSeconds) {
    const difference = Math.abs(track.duration - input.durationSeconds);
    score += difference <= 3 ? 0.1 : difference <= 8 ? 0.07 : difference <= 15 ? 0.03 : 0;
  }
  return Math.min(score, 0.98);
}

function cacheKey(input: LyricsLookupInput) {
  return [normalize(input.title), normalize(input.artist), normalize(input.album), input.durationSeconds ? Math.round(input.durationSeconds) : ""].join("|");
}

function validTracks(input: unknown) {
  const rows = z.array(z.unknown()).parse(input);
  return rows.flatMap((row) => {
    const parsed = lrclibTrackSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

export class LrclibLyricsProvider implements LyricsProvider {
  readonly name = "LRCLIB community lyrics";
  private readonly manual = new ManualLyricsProvider();
  private readonly fetcher: Fetcher;

  constructor(fetcher: Fetcher = globalThis.fetch) {
    this.fetcher = bindRuntimeFetch(fetcher);
  }

  private async search(url: URL) {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await this.fetcher(url, {
          headers: { "User-Agent": "Sonosphere/0.1 (local music-analysis prototype)" },
          signal: AbortSignal.timeout(15_000),
        });
        if (response.ok || (response.status !== 429 && response.status < 500)) return response;
        lastError = new Error(`LRCLIB returned HTTP ${response.status}.`);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("LRCLIB could not be reached.");
  }

  async findLyrics(input: LyricsLookupInput): Promise<LyricsLookup> {
    if (input.manualLyrics?.trim()) return this.manual.findLyrics(input);
    if (!input.title?.trim() || !input.artist?.trim()) {
      return unavailable("Automatic lyric lookup needs a confirmed song title and artist. The interpretation will remain sound-led.");
    }

    const url = new URL("https://lrclib.net/api/search");
    url.searchParams.set("track_name", input.title.trim());
    url.searchParams.set("artist_name", input.artist.trim());
    const key = cacheKey(input);
    const cached = lyricCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return structuredClone(cached.result);
    if (cached) lyricCache.delete(key);

    try {
      const response = await this.search(url);
      if (!response.ok) return unavailable(`LRCLIB lyric lookup returned HTTP ${response.status}; continuing without lyrics.`);

      const tracks = validTracks(await response.json());
      if (!tracks.length) return unavailable("LRCLIB returned no valid lyric records; continuing without lyrics.");
      const ranked = tracks
        .map((track) => ({ track, score: matchScore(track, input) }))
        .filter((candidate) => candidate.score >= 0)
        .sort((a, b) => b.score - a.score || Math.abs(a.track.duration - (input.durationSeconds ?? a.track.duration)) - Math.abs(b.track.duration - (input.durationSeconds ?? b.track.duration)));
      const best = ranked[0];
      if (!best) return unavailable("LRCLIB did not return an exact title-and-artist match; continuing without lyrics to avoid using the wrong song.");
      if (best.track.instrumental) return unavailable("LRCLIB identifies this recording as instrumental, so no lyrics were added.");

      const lyrics = best.track.plainLyrics?.trim();
      if (!lyrics) return unavailable("LRCLIB matched the recording but did not provide plain lyrics.");
      const result: LyricsLookup = {
        available: true,
        lyrics,
        source: `LRCLIB · ${best.track.trackName} — ${best.track.artistName}`,
        sourceKind: "community",
        licensed: false,
        confidence: best.score,
        displayNotice: "Automatically matched community-contributed lyrics from LRCLIB; verify exact wording before relying on it.",
      };
      lyricCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, result });
      return structuredClone(result);
    } catch (error) {
      console.error("LRCLIB lyric lookup failed.", error instanceof Error ? error.message : "Unknown error");
      const timedOut = error instanceof Error && /timeout|timed out|abort/i.test(`${error.name} ${error.message}`);
      return unavailable(timedOut ? "LRCLIB lyric lookup timed out twice; continuing without lyrics." : "LRCLIB lyric lookup was unavailable or returned invalid data; continuing without lyrics.");
    }
  }
}
