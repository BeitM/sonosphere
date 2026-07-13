# Roadmap

This roadmap reflects the implementation and limitations present on 2026-07-13. Items that depend on product direction are explicitly marked.

## Current phase

Prompt-generation prototype: prove that song evidence can be normalized into a coherent semantic interpretation, spatial plan, and prompt for a future explorable 3D world. Mock mode, validated output, and the main browser flow are operational.

## Immediate priorities

1. **Align controls with output behavior.** Either make `visualPreference`, emotional `intensity`, and evidence balance affect deterministic synthesis or clearly narrow the local-mode UI. The current controls imply more influence than the fallback applies.
2. **Define the audio-analysis handoff.** The upload is sent only to recognition, while full prompt generation receives no audio. Choose an explicit temporary-upload or derived-analysis reference before adding a real analyzer. This requires privacy and retention decisions.
3. **Correct and test evidence weighting.** Derive `artistStatements` weight from actual artist-statement availability, then add unit tests for normalization and all fallback levels.
4. **Plan safe dependency upgrades.** Recheck the Vite, Wrangler, Cloudflare plugin, Next.js, and transitive advisories together. Do not use `npm audit fix --force` without reviewing compatibility and the generated diff.
5. **Broaden regression coverage.** Add known and obscure fixture generation, invalid API input, upload validation, and live-AI failure fallback tests.

## Near-term improvements

- Extract feature-focused UI sections and local synthesis helpers when active work makes the current dense files costly to change; avoid a move-only reorganization.
- Decide whether the four UI-unused API routes are supported public endpoints or internal scaffolding, then document or consolidate them accordingly.
- Add one real recognition adapter, one rights-compatible lyrics source, and real acoustic analysis only after provider, disclosure, cost, and retention choices are made. **Product input required.**
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
- Provider selector environment variables are documented but not implemented.
- Audio extension and size constraints are duplicated in the client and server; move the shared constants to a client-safe module when upload work resumes.
- Local scaffold directories for D1/Drizzle/examples are empty and untracked. Confirm local tooling needs before cleanup.
- No formatter is configured. Add one only if the team wants an enforced style; avoid a repository-wide formatting change during feature work.

## Open questions

- Who is the first intended user: an internal creative team, individual creators, or an API consumer?
- Which world-generation system should receive the prompt, and what exact schema or constraints does it require?
- Must uploaded audio ever leave the application server? If so, which consent, retention, and deletion guarantees are required?
- Are manual lyrics and context acceptable only for development, or are they part of the intended product?
- Should live AI enrich fixture/local synthesis or become the primary production path?
- Are ChatGPT authentication, D1, and R2 intended near-term integrations or starter-template remnants?
