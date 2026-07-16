import {
  providers as mockProviders,
} from "./mock";
import {
  EmptyContextProvider,
  HttpMusicAnalysisProvider,
  ManualLyricsProvider,
  ManualRecognitionProvider,
  UnconfiguredMusicAnalysisProvider,
} from "./live";
import { LrclibLyricsProvider } from "./lrclib";

const music = process.env.MUSIC_ANALYSIS_PROVIDER === "http"
  ? new HttpMusicAnalysisProvider()
  : new UnconfiguredMusicAnalysisProvider();

export const liveProviders = {
  recognition: new ManualRecognitionProvider(),
  lyrics: process.env.LYRICS_PROVIDER === "manual" ? new ManualLyricsProvider() : new LrclibLyricsProvider(),
  context: new EmptyContextProvider(),
  music,
};

export function providersFor(useFixture: boolean) {
  return useFixture ? mockProviders : liveProviders;
}
