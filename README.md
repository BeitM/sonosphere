# Sonosphere

Sonosphere is a music-to-3D-world prototype. It accepts an uploaded song, confirms its identity, gathers lyrical and contextual evidence, interprets its musical arc, and produces a validated prompt for a coherent, explorable 3D environment. As an optional paid step, it can submit that prompt to World Labs and display the generated SPZ world in an embedded SparkJS viewer.

World generation is explicit, private by default, and separate from prompt generation. Sonosphere does not yet compose multiple Marble scenes, add first-person collision navigation, synchronize the world to audio, manage accounts, or persist application state.

The prototype appears intended for creative technologists and world-building teams evaluating how musical evidence can drive environment design. This audience is inferred from the workflow and generated artifacts; the repository does not contain a formal product brief.

## Technology stack

- TypeScript, React 19, and the Next.js App Router API, compiled by vinext and Vite
- Cloudflare Workers/Sites runtime integration through Wrangler
- Tailwind CSS 4 plus project-specific global CSS
- Zod schemas at API and AI-output boundaries
- OpenAI Responses API Structured Outputs in optional live mode
- Python 3.12, FastAPI, librosa, and FFmpeg for private acoustic analysis
- World Labs Marble API plus SparkJS and Three.js for optional generation and embedded SPZ viewing
- Node's built-in test runner and ESLint 9

## Run locally

Requirements: Node.js 22.13 or newer. Real uploads also require Docker, or Python 3.12 plus FFmpeg.

```bash
npm ci
copy .env.example .env.local
```

Start the acoustic analyzer in another terminal. Docker includes FFmpeg:

```bash
docker compose up --build audio-analysis
```

Or run it directly after installing FFmpeg:

```bash
python -m venv .venv
.venv\Scripts\pip install -r services/audio-analysis/requirements-dev.txt
.venv\Scripts\uvicorn app.main:app --app-dir services/audio-analysis --host 127.0.0.1 --port 8788
```

Then start the web app:

```bash
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
5. The browser uploads the recording to the private analyzer, which returns normalized acoustic features and section boundaries without retaining the file.
6. The server combines that analysis with manually supplied lyrics and context, then calculates confidence and adaptive evidence weights.
7. Three interpretation stages produce semantic meaning, spatial metaphors, a full creative world plan, and a separate Marble-ready prompt capped at 1,800 characters.
8. Refine the controls and regenerate, then copy the Marble prompt, inspect or copy the complete plan, or download the JSON result. The already-derived analysis is reused during regeneration.
9. Optionally review the model and estimated charge, start a private World Labs generation, monitor its operation, and explore the completed SPZ with orbit, pan, zoom, reset, quality, and fullscreen controls.

All API inputs and AI outputs are validated with Zod. The central `SongWorldAnalysis` object is serializable and ready for later database storage.

## Architecture

```text
Browser upload + guidance
  -> /api/song/identify
  -> user confirmation
  -> /api/song/analyze-audio
       -> private FastAPI/librosa analyzer
  -> /api/world/generate-prompt
       -> LyricsProvider
       -> SongContextProvider
       -> validated MusicalAnalysis supplied by the browser flow
       -> confidence + adaptive weights
       -> semantic interpretation
       -> spatial interpretation
       -> world prompt
  -> validated SongWorldAnalysis JSON
  -> optional /api/world-labs/generate
       -> private World Labs operation
       -> /api/world-labs/operations/{operationId}
       -> SparkJS SPZ viewer + Marble link
```

The provider contracts live in `lib/providers/types.ts`. `lib/providers/registry.ts` separates explicit fixture providers from real-upload providers; the analysis pipeline never depends on a vendor-specific SDK. Shared Zod schemas live in `lib/schemas.ts`, confidence and weighting logic in `lib/analysis/weights.ts`, and the orchestrated pipeline in `lib/analysis/pipeline.ts`.

### Project structure

```text
app/                    Next-compatible UI, global styles, and API routes
lib/schemas.ts          Shared request, provider, analysis, and output contracts
lib/providers/          Vendor-neutral interfaces, fixture adapters, and HTTP adapter
lib/analysis/           Confidence, weighting, interpretation, and prompt pipeline
lib/ai/                 Optional OpenAI Structured Output enhancement
lib/worldlabs/          Validated World Labs API adapter and contracts
services/audio-analysis/ FastAPI/librosa service, tests, and container image
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

- `POST /api/world-labs/generate` - start one confirmed, private World Labs generation
- `GET /api/world-labs/operations/{operationId}` - poll generation status and retrieve validated assets

## Environment variables

Copy `.env.example` to `.env.local`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `AI_MODE` | No | `mock` (default) uses deterministic local generation; `live` enables OpenAI. |
| `OPENAI_API_KEY` | Live mode only | Server-only OpenAI API credential. |
| `OPENAI_MODEL` | No | Structured-output model; defaults to `gpt-5.6-terra`. |
| `MUSIC_ANALYSIS_PROVIDER` | Real uploads | Set to `http` to enable the private analyzer. |
| `AUDIO_ANALYSIS_URL` | HTTP analyzer | Base URL of the analyzer, such as `http://127.0.0.1:8788`. |
| `AUDIO_ANALYSIS_TOKEN` | Production analyzer | Optional shared bearer token; set the same value in both processes. |
| `WORLD_LABS_API_KEY` | World generation only | Server-only key from the World Labs Platform. API billing is separate from Marble app credits. |
| `WORLD_LABS_ACCESS_TOKEN` | Hosted generation | A strong app-specific access code that protects the paid generation routes. Optional on localhost. |

Never prefix these variables with `NEXT_PUBLIC_`. Keys stay on the server and are not logged.

## World Labs generation and SparkJS viewing

Purchase API credits and create a key in the [World Labs Platform](https://platform.worldlabs.ai/), then put `WORLD_LABS_API_KEY` in `.env.local` and restart the web server. Marble web-app credits cannot be used by the API. The results page lists the documented credit range and requires a confirmation click before it sends anything billable. It never automatically retries the paid start request; operation polling is non-billable.

Every request sets the world to private with ID access disabled. Localhost may generate without a second application secret. Before hosting the feature, set a strong `WORLD_LABS_ACCESS_TOKEN`; users must enter that access code in the generation panel, while the actual World Labs key remains server-only.

When an operation completes, Sonosphere validates the response and passes the 100k, 500k, or full-resolution SPZ URL and World Labs scale/ground metadata to SparkJS. The embedded controls currently provide orbit, pan, zoom, reset, quality selection, and fullscreen, plus a link to the original Marble page. The collider GLB URL is retained in the normalized result for a later first-person controller, but walking and audio-reactive effects are not implemented yet. Generation state is browser-memory-only, so refreshing loses the active operation UI even though the generated world remains in the World Labs account.

## Development fixture mode

Mock mode works with no paid services and exposes three fixtures in the upload screen:

- **Amazing Grace** — a famous public-domain lyrical work with strong identity and contextual evidence (fallback level 1).
- **Glass Orchard** — a fabricated obscure lyrical song with sparse commentary and an ambiguous alternative match (level 2).
- **Untitled Current** — an unknown original instrumental with no lyrics or context; interpretation is sound-led (level 4).

The three development cards explicitly set `useFixture` and never masquerade as a real upload. Their provider outputs remain deterministic, so fallback behavior stays repeatable even when the analyzer or OpenAI is unavailable.

## Real audio analysis

`services/audio-analysis` decodes each upload in an isolated temporary directory and extracts tempo, key/mode estimates, energy, tension, brightness, density, rhythmic intensity, dynamic range, section boundaries, and notable onsets. The directory is removed before the request completes. The TypeScript HTTP adapter validates the returned object with `musicalAnalysisSchema` before the pipeline can use it.

These features are computational estimates, not definitive musicological labels. Real-upload boundaries are deliberately labeled opening, development regions, and ending: they are changes in timbre and energy, not claims that a region is a verse or chorus. Vocal prominence is a harmonic-content proxy, and emotional features describe acoustic evidence rather than creator intent. Compressed formats require FFmpeg; the included container installs it.

## Automatic lyrics and manual fallback

For a real upload with a confirmed title and artist, Sonosphere automatically searches [LRCLIB](https://www.lrclib.net/docs) and accepts only an exact normalized title-and-artist match. Album and audio duration help rank duplicate recordings. LRCLIB lyrics are community-contributed, marked unlicensed in the analysis, and never reproduced in the generated world prompt. Set `LYRICS_PROVIDER=manual` to disable network lookup.

Pasted lyrics always override automatic lookup. AZLyrics does not provide a supported lyrics API and actively gates automated page access, so Sonosphere does not scrape it or bypass its controls. If LRCLIB has no match, the UI links to AZLyrics and Genius so the user can find and paste text they may use. A failed lookup degrades to a sound-led interpretation instead of breaking generation.

## Confidence and adaptive weighting

Confidence is tracked separately for identification, official/manual lyrics, transcription, music analysis, external context, and the overall interpretation. `fallbackLevel()` categorizes the available evidence:

1. Strong identity + lyrics + context + music
2. Identity + lyrics + music, limited commentary
3. Identity + music, lyrics missing or weak
4. Unknown/original song, led by music and user guidance

`calculateEvidenceWeights()` begins with confidence-scaled source priors, then adapts to missing evidence and the user's selected balance. An instrumental can be predominantly musical; a lyrical work with little commentary shifts toward lyrics and structure. The result is normalized and corrected so the five weights always sum to exactly 1.

## AI interpretation stages

When `AI_MODE=live`, `lib/ai/openai.ts` uses the OpenAI Responses API with `gpt-5.6-terra` by default and makes three server-side Structured Output calls:

1. **Semantic interpretation** — themes, conflicts, images, lyric/music relationship, emotional arc, source attribution, and uncertainty.
2. **Spatial translation** — scale, accessibility, distance, enclosure, palette, architecture, symbolic landmarks, and a song-derived topology (`linear`, `looping`, `branching`, `radial`, `layered`, or `distributed`) with connected areas and an orientation strategy.
3. **World prompts** — a complete multi-region creative plan plus a non-repeating Marble 1.1/1.1 Plus prompt concentrated on exactly one primary explorable area and held below 1,800 characters for World Labs' documented 2,000-character limit.

Every response is parsed through its Zod schema. The Structured Output schemas use required nullable fields where a value can be absent. Post-processing removes an accidentally repeated full prompt and hard-limits the Marble prompt without cutting away its essential exclusions. Scale is a hard geometry constraint; emotional intensity changes pressure and contrast without overriding scale or selecting an architectural style. Spatial structure is not forced into opening, development, climax, and ending fields: the AI selects a topology from the song evidence, describes connected areas for the full plan, and explains how orientation and transformation work. The Marble prompt then selects the focal area and expresses that topology internally through paths, sightlines, thresholds, and viewpoints instead of asking one generation to build multiple named zones. If a provider fails, an AI response is invalid, or live AI is unavailable, the server returns the validated local synthesis, adds a limitation note, and displays a prominent fallback warning instead of presenting it as the full AI result. For confirmed well-known songs, the live interpreter may use stable common interpretations while keeping them distinct from documented creator intent.

## Adding providers

### Recognition

Implement `SongRecognitionProvider` from `lib/providers/types.ts`. Translate the vendor response into `SongIdentificationResult`, including provider name, calibrated confidence, and alternatives. Register it server-side in the provider registry. Send audio to the vendor only after adding a clear disclosure in the upload UI, and delete any temporary files in `finally` blocks.

### Lyrics

Implement `LyricsProvider` and preserve `sourceKind`, `licensed`, confidence, and the display notice. The current LRCLIB adapter is an unlicensed community source; a future licensed adapter can replace it through the registry. Do not automate AZLyrics or other sites that block scraping. Keep full copyrighted lyrics off the results screen and out of the final world prompt. A transcription adapter should implement the separate `LyricsTranscriptionProvider` interface and report singing-transcription confidence independently.

### Music analysis

`HttpMusicAnalysisProvider` implements this boundary and validates the private service response. Extend or replace the service behind the same contract when adding source separation or higher-quality section labeling. Real uploads fail clearly when the analyzer is unconfigured; fixture fallback occurs only when the user explicitly chooses a development fixture.

### Context research

Implement `SongContextProvider` using controlled, attributable sources. Keep direct artist statements, factual background, published interpretation, community interpretation, and AI inference distinct. Do not upgrade a fan theory into confirmed intent.

## Privacy and storage

- Audio is not permanently stored by the application.
- Real audio is sent only to the configured analyzer URL and is deleted with its per-request temporary directory before the response completes.
- Fixture recognition receives only filename, type, and size; fixture analysis never reads the audio bytes.
- The current app does not send audio to OpenAI. In live AI mode, derived evidence—including legally available or manually supplied lyric text—can be sent to OpenAI for structured interpretation.
- A future external recognition or analysis adapter must disclose where audio leaves the server and implement temporary-file cleanup.
- Uploaded audio, lyrics, and secrets are not intentionally logged.
- Results are kept only in browser memory until the page is refreshed or JSON is downloaded.
- If the user confirms World Labs generation, the prompt is sent to World Labs and the resulting world is retained according to that account and service's settings; Sonosphere does not proxy the SPZ bytes into its own storage.

## Example outputs

See [`examples/generated-prompts.md`](examples/generated-prompts.md) for representative output from all three fallback cases. The live UI also exposes the full structured analysis behind **Download JSON**.

## Known limitations

- Real recognition, licensed lyrics, research, source separation, and transcription adapters are extension points, not configured providers. LRCLIB supplies best-effort community lyrics but is not a licensed catalog.
- The acoustic analyzer provides useful estimates but not stem separation, robust vocal transcription, or authoritative key/section labels.
- The local generator is deterministic and fixture-aware; OpenAI provides richer synthesis only when explicitly enabled.
- In local mode, `intensity` and `scale` directly constrain the Marble prompt. `visualPreference` still requires live AI for semantic use, and balance changes evidence weights more strongly than deterministic prose.
- Context citations are mock summaries in development mode and should not be treated as live research.
- The embedded viewer is orbit-based. First-person walking, collider integration, timed lighting, deformation, particles, camera paths, and audio reactivity belong to later phases.
- Audio is held by the browser during the multi-step flow. Production uploads should use bounded temporary object storage and explicit deletion guarantees.

For implementation status, data-flow details, and known issues, see [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md). Future work and decisions requiring product input are tracked in [`ROADMAP.md`](ROADMAP.md).

## Recommended next steps

1. Deploy the private audio-analysis container behind HTTPS and configure a strong shared token.
2. Add one recognition adapter (AudD or ACRCloud) behind the existing contract and disclose server-to-provider audio transfer.
3. Evaluate a licensed lyrics source for production while retaining LRCLIB and the manual workflow for local prototyping.
4. Add citation-aware context research using controlled domains and evidence deduplication.
5. Persist versioned `SongWorldAnalysis` records only after accounts and retention controls exist.
6. Add collider-backed first-person navigation to the existing SparkJS viewer if walking is important to testing.
7. Build audio reactivity as a separate layer that maps `emotionalArc` and musical sections to lights, materials, particles, and camera behavior without changing the persistent base world.
