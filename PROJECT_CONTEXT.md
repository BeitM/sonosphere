# Project context

Snapshot reviewed: 2026-07-13.

## Purpose and audience

Sonosphere is phase one of a proposed music-to-3D-world system. It turns evidence about a song into a structured interpretation, spatial metaphor, scene plan, and prompt for a future explorable-world generator. It currently targets prompt exploration, not 3D rendering.

The likely audience is creative technologists or world-building teams evaluating music-driven environment concepts. This is an inference from the UI and output format; the repository has no formal product or customer definition.

## Architecture

The application is a TypeScript/React App Router project compiled by vinext/Vite for a Cloudflare Worker target.

- `app/studio.tsx` owns the four UI states (`upload`, `confirm`, `generating`, and `results`), browser-held form state, API calls, prompt copying, and JSON download.
- `app/api/` validates HTTP input and maps requests to providers or the full analysis pipeline.
- `lib/schemas.ts` is the canonical contract for recognition, evidence, analysis, refinements, and final output.
- `lib/providers/types.ts` defines recognition, lyrics, context, music-analysis, and transcription boundaries. `lib/providers/mock.ts` is the only registered provider set.
- `lib/analysis/weights.ts` calculates confidence, normalized evidence weights, and fallback levels.
- `lib/analysis/pipeline.ts` gathers mock evidence, builds deterministic semantic and spatial interpretations, creates the world prompt, and validates the complete result.
- `lib/ai/openai.ts` optionally replaces the three synthesized stages with validated OpenAI Structured Outputs. Failure returns the local result with an added limitation.
- `worker/index.ts` serves the vinext app and delegates image optimization to Cloudflare bindings.
- `vite.config.ts` configures vinext, the Cloudflare Vite plugin, and Sites packaging. `.openai/hosting.json` currently declares no D1 or R2 binding.

The project has two commits: the initial prototype and a follow-up aligning OpenAI structured output with the SDK helper. There is not enough history to infer additional architectural intent.

## Main data flow

1. The browser validates the filename extension and 25 MB limit, then sends the selected file or a generated fixture file to `POST /api/song/identify`.
2. The server parses the multipart body, repeats basic validation, and passes only filename, MIME type, and size to the mock recognition provider.
3. The user confirms metadata and adds optional lyrics, context, personal interpretation, visual guidance, and refinement controls.
4. The browser sends JSON, without the audio file, to `POST /api/world/generate-prompt`.
5. The pipeline requests lyrics, context, and musical analysis in parallel from mock providers; calculates confidence, weights, and fallback level; then builds and validates the interpretation, spatial translation, and prompt.
6. In `AI_MODE=live`, derived evidence may be sent to OpenAI for three Structured Output calls. Invalid or failed live output falls back to the local validated result.
7. The browser holds the result in memory and can regenerate it, copy the prompt, or download the complete JSON. Refreshing the page discards the state.

## API surface

| Route | Purpose | Used by current UI |
| --- | --- | --- |
| `POST /api/song/identify` | Multipart song recognition | Yes |
| `POST /api/world/generate-prompt` | Complete evidence and prompt pipeline | Yes |
| `POST /api/song/lyrics` | Standalone lyrics lookup | No |
| `POST /api/song/context` | Standalone context lookup | No |
| `POST /api/song/analyze-audio` | Standalone mock music analysis | No |
| `POST /api/song/interpret` | Interpretation-only projection of the full pipeline | No |

## External services and environment

Mock mode requires no external service. Live AI uses the OpenAI Responses API. vinext, Wrangler, and the Cloudflare Vite plugin provide the build/runtime layer; no live recognition, lyrics, research, acoustic-analysis, database, object-storage, or 3D-generation integration is configured.

| Variable | Status |
| --- | --- |
| `AI_MODE` | Optional; only exact value `live` enables OpenAI, otherwise local mode is used. |
| `OPENAI_API_KEY` | Required only for live AI and read server-side. |
| `OPENAI_MODEL` | Optional; defaults to `gpt-5-mini`. |
| `SONG_RECOGNITION_PROVIDER` | Documented placeholder; not read by the code. |
| `LYRICS_PROVIDER` | Documented placeholder; not read by the code. |
| `MUSIC_ANALYSIS_PROVIDER` | Documented placeholder; not read by the code. |

`.env.example` and the local environment contain the same variable names. Values in `.env.local` were not inspected or printed. Tool-only variables such as `WRANGLER_LOG_PATH`, `WRANGLER_WRITE_LOGS`, `MINIFLARE_REGISTRY_PATH`, and `CODEX_SANDBOX` are configured in scripts or `vite.config.ts`, not in the application environment example.

## Implementation status

Working in the reviewed snapshot:

- Deterministic known, obscure, and unknown-instrumental fixture flows.
- Input and output validation with Zod.
- Confidence, adaptive weight normalization, and four fallback levels.
- Server-rendered UI, prompt regeneration, clipboard copy, and JSON download.
- Optional OpenAI enhancement with validated local fallback.
- Cloudflare-targeted production build and a development server.

Not implemented:

- Real audio recognition or acoustic analysis.
- Licensed lyrics, transcription, or live context research.
- Database/object storage, accounts, retention controls, or use of the existing auth helper.
- 3D-world generation, Marble integration, camera behavior, or audio-reactive systems.

## Known issues and limitations

- Mock music analysis is selected by fixture ID and never reads audio bytes. The complete generation request does not contain audio, so a real analyzer cannot be inserted into the current pipeline without a deliberate upload/reference flow.
- The local pipeline accepts `visualPreference` and `refinement.intensity` but does not use them. `balance` changes reported weights, while deterministic prompt content remains largely fixture-based.
- `artistStatements` receives weight from aggregate external-context confidence even when the context contains no artist statement. This can make the displayed evidence mix overstate that source.
- The UI calls only two of the six routes. The standalone lyrics, context, analysis, and interpretation routes may be extension points, but that intent is not documented in code.
- `app/chatgpt-auth.ts` and `compactAnalysisForAI()` are not referenced. They may be scaffold or future-integration code; do not delete them without confirming intended hosting/auth behavior.
- `app/studio.tsx`, `app/globals.css`, and `lib/analysis/pipeline.ts` are dense, mostly single-file implementations. They are manageable at the current prototype size but are the first candidates for feature-oriented extraction if they grow.
- Automated coverage consists of two built-worker integration tests: server rendering and the fallback-level-four generation path. Known/obscure flows, invalid requests, weights, browser interactions, live-AI fallback, and upload validation are untested.
- `npm audit` reported 11 dependency advisories (2 low, 3 moderate, 6 high) on 2026-07-13, mainly in the Vite/Cloudflare development toolchain. Suggested full fixes cross declared version ranges or include misleading breaking resolutions, so no automatic fix was applied.
- File type checks accept a recognized extension even when MIME type is unexpected, and the size check occurs after `request.formData()` has parsed the body. These constraints are acceptable for the mock prototype but should be hardened before sending files to external providers.
- The browser and server define the supported extensions and 25 MB limit separately (`app/studio.tsx` and `lib/api.ts`), creating a small drift risk. A client-safe shared constraints module would remove the duplication.

Ignored build products and local state (`dist/`, `.vinext/`, `.wrangler/`, `outputs/`, logs, `.env.local`, and TypeScript build info) are not committed. Several local scaffold directories are empty and untracked; their purpose cannot be established from Git.

## Technical decisions already encoded

- Keep provider contracts vendor-neutral and server-side.
- Validate all API inputs and AI outputs.
- Keep a deterministic, no-key development path and fail back to it from live AI.
- Attribute and weight evidence while keeping uncertain interpretation visibly uncertain.
- Generate a persistent, navigable base world rather than a camera shot or timed experience.
- Avoid permanent audio storage and keep result state in browser memory during this phase.

## Areas needing clarification

- Which users and downstream world generator define the first production use case?
- Should the unused modular routes remain public extension points, become internal functions, or be removed later?
- Is ChatGPT-hosted authentication intended for this phase or inherited scaffold code?
- What upload, retention, and deletion guarantees are required before audio leaves the local server?
- Which recognition, lyrics, analysis, and context providers are acceptable with respect to cost, licensing, privacy, and reliability?
- Should D1/R2 and the empty migration scaffolds remain reserved, or should persistence stay out of scope until accounts exist?
