# Vercel deployment

Sonosphere runs as two services in local development:

1. The Next.js web application handles the interface, orchestration, OpenAI calls, and World Labs calls.
2. The private Python audio-analysis service runs librosa and FFmpeg against temporary audio files.

The two PowerShell windows keep both services running locally. Production hosting replaces those terminals with managed processes.

## Recommended production layout

- Deploy the web application to Vercel using the repository root and the Next.js framework preset. `vercel.json` selects the native Next.js build instead of the Cloudflare/vinext build.
- Deploy `services/audio-analysis/Dockerfile` to a container host such as Google Cloud Run, Fly.io, Railway, or Render.
- Keep the analyzer private behind HTTPS and use the same strong `AUDIO_ANALYSIS_TOKEN` in both services.

## Web application environment

Configure these in Vercel Project Settings, then redeploy:

```text
MUSIC_ANALYSIS_PROVIDER=http
AUDIO_ANALYSIS_URL=https://your-analyzer.example
AUDIO_ANALYSIS_TOKEN=one-strong-shared-secret
LYRICS_PROVIDER=lrclib
AI_MODE=live
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.6-terra
OPENAI_IMAGE_MODEL=gpt-image-2
WORLD_LABS_API_KEY=...
WORLD_LABS_ACCESS_TOKEN=another-strong-access-code
```

`AI_MODE`, OpenAI, and World Labs settings are optional if those capabilities are not needed. Never add `NEXT_PUBLIC_` to secrets.

## Analyzer environment

Configure the same `AUDIO_ANALYSIS_TOKEN` on the container host. Build from `services/audio-analysis/Dockerfile`; the image installs Python, FFmpeg, libsndfile, librosa, and the FastAPI application. The container must expose port `8788` through its host-provided HTTPS URL.

## Important Vercel upload limit

Vercel Functions currently limit request and response payloads to 4.5 MB. Sonosphere's web route currently accepts audio uploads up to 25 MB before forwarding them to the analyzer, so the complete upload contract is not Vercel-compatible yet.

For an initial private deployment, use audio files safely below 4.5 MB. For the intended 25 MB limit, implement direct browser-to-analyzer upload with short-lived authorization, or direct object-storage upload followed by analyzer retrieval. Do not put the permanent analyzer token in browser code.

## Deploy

1. Push the repository to GitHub.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Keep the root directory as the repository root and the framework preset as **Next.js**.
4. Add the web environment variables above.
5. Deploy. Future pushes to the production branch will deploy automatically.

The native deployment build can be checked locally with `npm run build:vercel`.
