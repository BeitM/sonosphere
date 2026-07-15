# Sonosphere agent guide

## Purpose

Sonosphere is a prompt-generation prototype for translating song identity, lyrics, context, musical structure, and user guidance into a validated `SongWorldAnalysis` and an explorable 3D-world prompt. It does not render 3D worlds or persist user data.

## Important paths

- `app/studio.tsx`: client workflow and results UI.
- `app/api/`: Next-compatible HTTP boundaries.
- `lib/schemas.ts`: canonical Zod contracts and inferred TypeScript types.
- `lib/providers/`: provider interfaces and mock implementations.
- `lib/analysis/`: confidence, weighting, deterministic synthesis, and orchestration.
- `lib/ai/openai.ts`: optional live Structured Output enhancement.
- `services/audio-analysis/`: private FastAPI/librosa acoustic-analysis service.
- `worker/index.ts`, `vite.config.ts`, `build/sites-vite-plugin.ts`: vinext/Cloudflare build and runtime integration. Despite its name, `build/` contains tracked source.
- `tests/rendered-html.test.mjs`: built-worker integration tests.
- `PROJECT_CONTEXT.md` and `ROADMAP.md`: detailed status and future decisions.

## Commands

Use Node.js 22.13 or newer and the committed npm lockfile.

```bash
npm ci
npm run dev
npm run build
npm run lint
npm run typecheck
npm test

# Audio service (Python 3.12; FFmpeg required for compressed audio)
python -m venv .venv
.venv\Scripts\pip install -r services/audio-analysis/requirements-dev.txt
.venv\Scripts\python -m pytest services/audio-analysis/tests
```

No formatter is configured. Do not introduce or apply a repository-wide formatter incidentally.

## Conventions and boundaries

- Use TypeScript, strict checking, `@/` imports across top-level boundaries, and local relative imports within a focused module when already established.
- Validate external requests, provider results, and AI results with the schemas in `lib/schemas.ts`.
- Keep provider-specific SDK code behind `lib/providers/types.ts`; the analysis pipeline must not depend directly on a vendor adapter.
- Keep credentials server-only. Do not add `NEXT_PUBLIC_` variants or log audio, lyrics, or secrets.
- Preserve explicit deterministic fixture mode and validated fallback behavior when live AI fails.
- Never use fixture-derived audio or lyrics for a real upload. Validate the audio service response before it enters the analysis pipeline.
- Treat world generation, persistence, authentication, and audio-reactive rendering as separate future layers unless a task explicitly expands scope.
- Inspect the schema, calling route, provider contract, pipeline, and relevant UI before changing shared data shapes.
- Run the smallest relevant checks after a change; run lint, typecheck, and tests for cross-layer changes.
- Do not delete ignored outputs or empty scaffold directories without confirming their local use.

## Known limitations

Real recognition, licensed lyrics, and live context research are not implemented. AZLyrics is exposed only as a user-opened search link because automated access is blocked and no licensed API is available. Audio reactivity and 3D generation remain separate future layers. See `PROJECT_CONTEXT.md` for details.
