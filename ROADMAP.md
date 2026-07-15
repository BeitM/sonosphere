# Roadmap

This roadmap reflects the implementation and limitations present on 2026-07-15. Items that depend on product direction are explicitly marked.

## Current phase

Prompt-generation prototype: prove that song evidence can be normalized into a coherent semantic interpretation, spatial plan, and prompt for a future explorable 3D world. Explicit fixtures, real acoustic analysis, validated output, and the main browser flow are operational locally.

## Immediate priorities

1. **Deploy and harden the analyzer.** Put the container behind HTTPS, configure a strong shared token, enforce platform request limits, and add health/latency/error monitoring before public use.
2. **Align controls with output behavior.** Make `visualPreference`, emotional `intensity`, and evidence balance affect deterministic synthesis as clearly as they affect live AI.
3. **Correct and test evidence weighting.** Derive `artistStatements` weight from actual artist-statement availability, then add unit tests for normalization and all fallback levels.
4. **Plan safe dependency upgrades.** Recheck the Vite, Wrangler, Cloudflare plugin, Next.js, and transitive advisories together. Do not use `npm audit fix --force` without reviewing compatibility and the generated diff.
5. **Broaden regression coverage.** Add known and obscure fixture generation, invalid API input, compressed-audio decoding, upload limits, and live-AI failure fallback tests.

## Near-term improvements

- Extract feature-focused UI sections and local synthesis helpers when active work makes the current dense files costly to change; avoid a move-only reorganization.
- Decide whether the four UI-unused API routes are supported public endpoints or internal scaffolding, then document or consolidate them accordingly.
- Add one real recognition adapter and one licensed lyrics source after provider, disclosure, cost, and retention choices are made. **Product input required.**
- Improve the analyzer with source separation, singing-aware transcription, and stronger structural labeling only if the product needs those costs and dependencies.
- Add citation-aware context research with clear separation between artist statements, facts, published readings, community readings, and AI inference. **Source-policy input required.**
- Harden upload validation, request-size enforcement, temporary-file cleanup, and client-safe error responses before external audio transfer.

## Later features

- Build an adapter for the selected 3D-world generator using `worldPrompt.prompt` and `scenePlan`. **Generator choice required.**
- Add camera paths, timed lighting, particles, deformation, and other audio-reactive behavior as a layer separate from the persistent base world.
- Add versioned persistence only with accounts, explicit retention controls, and a deletion model. **Product and privacy input required.**
- Evaluate authentication and deployment access once the intended audience and hosting model are known.

## Technical debt

- `build/sites-vite-plugin.ts` is tracked source in a directory name commonly associated with generated output. Consider moving it under `config/` or `lib/build/` when related build work occurs.
- `app/chatgpt-auth.ts` and `compactAnalysisForAI()` are currently unused; confirm intent before retaining or removing them.
- The real provider registry is intentionally minimal: manual identity/lyrics plus HTTP acoustic analysis. Add selectors only alongside actual provider adapters.
- Audio extension and size constraints are duplicated in the client and server; move the shared constants to a client-safe module when upload work resumes.
- Local scaffold directories for D1/Drizzle/examples are empty and untracked. Confirm local tooling needs before cleanup.
- No formatter is configured. Add one only if the team wants an enforced style; avoid a repository-wide formatting change during feature work.

## Open questions

- Who is the first intended user: an internal creative team, individual creators, or an API consumer?
- Which world-generation system should receive the prompt, and what exact schema or constraints does it require?
- Where should the private analyzer run, and which consent, retention, deletion, and observability guarantees are required?
- Are manual lyrics and context acceptable only for development, or are they part of the intended product?
- Should live AI enrich fixture/local synthesis or become the primary production path?
- Are ChatGPT authentication, D1, and R2 intended near-term integrations or starter-template remnants?
