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

const music = process.env.MUSIC_ANALYSIS_PROVIDER === "http"
  ? new HttpMusicAnalysisProvider()
  : new UnconfiguredMusicAnalysisProvider();

export const liveProviders = {
  recognition: new ManualRecognitionProvider(),
  lyrics: new ManualLyricsProvider(),
  context: new EmptyContextProvider(),
  music,
};

export function providersFor(useFixture: boolean) {
  return useFixture ? mockProviders : liveProviders;
}
