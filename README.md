# Sonosphere

Sonosphere is the first phase of a music-to-3D-world system. It accepts an uploaded song, confirms its identity, gathers lyrical and contextual evidence, interprets its musical arc, and produces a validated prompt for a coherent, explorable 3D environment.

This phase deliberately stops at prompt generation. It does not contain a 3D renderer, Marble integration, camera system, audio-reactive effects, accounts, or persistence.

The prototype appears intended for creative technologists and world-building teams evaluating how musical evidence can drive environment design. This audience is inferred from the workflow and generated artifacts; the repository does not contain a formal product brief.

## Technology stack

- TypeScript, React 19, and the Next.js App Router API, compiled by vinext and Vite
- Cloudflare Workers/Sites runtime integration through Wrangler
- Tailwind CSS 4 plus project-specific global CSS
- Zod schemas at API and AI-output boundaries
- OpenAI Responses API Structured Outputs in optional live mode
- Node's built-in test runner and ESLint 9

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm ci
copy .env.example .env.local
npm run dev
```

Open the local URL printed by the development server. Build and verify with:

```bash
npm run build
npm run lint
npm run typecheck
npm test
```

There is currently no formatter dependency or formatter-check command. The committed `package-lock.json` is the source of truth for dependency installation.

## How the prototype works

The main flow is:

1. Upload MP3, WAV, M4A, or FLAC (25 MB maximum in this prototype).
2. The recognition provider returns a match, confidence, alternatives, and metadata.
3. Confirm or correct the detected title, artist, and album.
4. Add optional lyrics, context, a personal reading, and visual guidance.
5. The server gathers available evidence and calculates confidence.
6. Adaptive evidence weights determine how much influence each source receives.
7. Three interpretation stages produce semantic meaning, spatial metaphors, and the final world prompt.
8. Refine the balance and regenerate, then copy the prompt or download the complete JSON result.

All API inputs and AI outputs are validated with Zod. The central `SongWorldAnalysis` object is serializable and ready for later database storage.

## Architecture

```text
Browser upload + guidance
  -> /api/song/identify
  -> user confirmation
  -> /api/world/generate-prompt
       -> LyricsProvider
       -> SongContextProvider
       -> MusicAnalysisProvider
       -> confidence + adaptive weights
       -> semantic interpretation
       -> spatial interpretation
       -> world prompt
  -> validated SongWorldAnalysis JSON
```

The provider contracts live in `lib/providers/types.ts`. Mock implementations are registered in `lib/providers/mock.ts`; the analysis pipeline never depends on a vendor-specific SDK. Shared Zod schemas live in `lib/schemas.ts`, confidence and weighting logic in `lib/analysis/weights.ts`, and the orchestrated pipeline in `lib/analysis/pipeline.ts`.

### Project structure

```text
app/                    Next-compatible UI, global styles, and API routes
lib/schemas.ts          Shared request, provider, analysis, and output contracts
lib/providers/          Vendor-neutral interfaces and deterministic mock adapters
lib/analysis/           Confidence, weighting, interpretation, and prompt pipeline
lib/ai/                 Optional OpenAI Structured Output enhancement
worker/                 Cloudflare Worker entry point and image optimization
build/                  Source Vite plugin that packages Sites metadata at build time
tests/                  Built-worker integration tests
examples/               Representative generated prompt excerpts
public/                 Static assets
.openai/hosting.json    Sites project metadata; D1 and R2 are currently unconfigured
```

API routes:

- `POST /api/song/identify` — multipart audio recognition
- `POST /api/song/lyrics` — rights-aware lyrics lookup or manual lyrics
- `POST /api/song/context` — curated/manual context research
- `POST /api/song/analyze-audio` — modular musical analysis
- `POST /api/song/interpret` — semantic interpretation result
- `POST /api/world/generate-prompt` — complete analysis and final world prompt

## Environment variables

Copy `.env.example` to `.env.local`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `AI_MODE` | No | `mock` (default) uses deterministic local generation; `live` enables OpenAI. |
| `OPENAI_API_KEY` | Live mode only | Server-only OpenAI API credential. |
| `OPENAI_MODEL` | No | Structured-output model; defaults to `gpt-5-mini`. |
| `SONG_RECOGNITION_PROVIDER` | No | Reserved provider selector; currently `mock`. |
| `LYRICS_PROVIDER` | No | Reserved provider selector; currently `mock`. |
| `MUSIC_ANALYSIS_PROVIDER` | No | Reserved provider selector; currently `mock`. |

Never prefix these variables with `NEXT_PUBLIC_`. Keys stay on the server and are not logged.

## Mock development mode

Mock mode works with no paid services and exposes three fixtures in the upload screen:

- **Amazing Grace** — a famous public-domain lyrical work with strong identity and contextual evidence (fallback level 1).
- **Glass Orchard** — a fabricated obscure lyrical song with sparse commentary and an ambiguous alternative match (level 2).
- **Untitled Current** — an unknown original instrumental with no lyrics or context; interpretation is sound-led (level 4).

Uploaded audio is not decoded in mock mode. The provider uses the selected fixture and filename, while the mock analyzer returns structured musical features. This makes fallback behavior repeatable.

## Confidence and adaptive weighting

Confidence is tracked separately for identification, official/manual lyrics, transcription, music analysis, external context, and the overall interpretation. `fallbackLevel()` categorizes the available evidence:

1. Strong identity + lyrics + context + music
2. Identity + lyrics + music, limited commentary
3. Identity + music, lyrics missing or weak
4. Unknown/original song, led by music and user guidance

`calculateEvidenceWeights()` begins with confidence-scaled source priors, then adapts to missing evidence and the user's selected balance. An instrumental can be predominantly musical; a lyrical work with little commentary shifts toward lyrics and structure. The result is normalized and corrected so the five weights always sum to exactly 1.

## AI interpretation stages

When `AI_MODE=live`, `lib/ai/openai.ts` makes three server-side Structured Output calls:

1. **Semantic interpretation** — themes, conflicts, images, lyric/music relationship, emotional arc, source attribution, and uncertainty.
2. **Spatial translation** — scale, accessibility, distance, enclosure, palette, architecture, symbolic landmarks, and the path through the world.
3. **World prompt** — a polished prompt for a persistent, navigable base environment with connected regions and clear generation constraints.

Every response is parsed through its Zod schema. If a provider fails, an AI response is invalid, or live AI is unavailable, the server returns the validated local synthesis and adds a limitation note instead of breaking the workflow. The interface shows concise conclusions—not private chain-of-thought.

## Adding providers

### Recognition

Implement `SongRecognitionProvider` from `lib/providers/types.ts`. Translate the vendor response into `SongIdentificationResult`, including provider name, calibrated confidence, and alternatives. Register it server-side in the provider registry. Send audio to the vendor only after adding a clear disclosure in the upload UI, and delete any temporary files in `finally` blocks.

### Lyrics

Implement `LyricsProvider`, prefer a licensed API, and preserve `sourceKind`, `licensed`, confidence, and the display notice. Never scrape random lyrics sites. Keep full copyrighted lyrics off the results screen and out of the final world prompt. A transcription adapter should implement the separate `LyricsTranscriptionProvider` interface and report singing-transcription confidence independently.

### Music analysis

Implement `MusicAnalysisProvider` and return normalized features, sections, notable moments, and per-feature confidence. A future server service can call Essentia/librosa, while a browser adapter can calculate basic Web Audio features. Provider failure should fall back to fixtures or an empty/low-confidence analysis rather than abort interpretation.

### Context research

Implement `SongContextProvider` using controlled, attributable sources. Keep direct artist statements, factual background, published interpretation, community interpretation, and AI inference distinct. Do not upgrade a fan theory into confirmed intent.

## Privacy and storage

- Audio is not permanently stored by the application.
- Mock recognition receives only filename, type, and size; mock analysis never reads the audio bytes.
- The current app does not send audio to OpenAI. In live AI mode, derived evidence—including legally available or manually supplied lyric text—can be sent to OpenAI for structured interpretation.
- A future external recognition or analysis adapter must disclose where audio leaves the server and implement temporary-file cleanup.
- Uploaded audio, lyrics, and secrets are not intentionally logged.
- Results are kept only in browser memory until the page is refreshed or JSON is downloaded.

## Example outputs

See [`examples/generated-prompts.md`](examples/generated-prompts.md) for representative output from all three fallback cases. The live UI also exposes the full structured analysis behind **Download JSON**.

## Known limitations

- Mock analysis does not inspect acoustic content, duration, tags, or corruption beyond basic file validation.
- Live recognition, licensed lyrics, research, source separation, and transcription adapters are extension points, not configured providers.
- The local generator is deterministic and fixture-aware; OpenAI provides richer synthesis only when explicitly enabled.
- In local mode, `visualPreference` and the `intensity` refinement are accepted but do not currently change the generated world. The balance control changes evidence weights, but those weights do not substantially rewrite deterministic prompt content.
- Context citations are mock summaries in development mode and should not be treated as live research.
- Prompt generation describes a static/persistent base world. Timed lighting, deformation, particles, camera paths, and audio reactivity belong to later phases.
- Audio is held by the browser during the multi-step flow. Production uploads should use bounded temporary object storage and explicit deletion guarantees.

For implementation status, data-flow details, and known issues, see [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md). Future work and decisions requiring product input are tracked in [`ROADMAP.md`](ROADMAP.md).

## Recommended next steps

1. Add one recognition adapter (AudD or ACRCloud) behind the existing contract and disclose server-to-provider audio transfer.
2. Add a licensed lyrics source plus the existing manual lyrics workflow.
3. Add real acoustic analysis with an isolated Python service or an Essentia pipeline.
4. Add citation-aware context research using controlled domains and evidence deduplication.
5. Persist versioned `SongWorldAnalysis` records only after accounts and retention controls exist.
6. Build a Marble adapter that consumes `worldPrompt.prompt` and `scenePlan`; keep provider-specific prompt tuning outside the interpretation core.
7. Build the 3D experience as a separate layer that maps `emotionalArc` and musical sections to regions, camera paths, and later audio-reactive events.
