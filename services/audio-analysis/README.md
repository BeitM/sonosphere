# Audio analysis service

This private FastAPI service decodes an uploaded recording and returns the `MusicalAnalysis` JSON consumed by Sonosphere. It uses librosa for deterministic rhythm, tonal, spectral, dynamic, structural, and notable-moment measurements. It does not retain uploads; each request uses an isolated temporary directory that is removed before the response completes.

## Local setup

Use Python 3.12 and install FFmpeg so compressed formats can be decoded.

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r services/audio-analysis/requirements-dev.txt
uvicorn app.main:app --app-dir services/audio-analysis --host 127.0.0.1 --port 8788
```

Set `MUSIC_ANALYSIS_PROVIDER=http` and `AUDIO_ANALYSIS_URL=http://127.0.0.1:8788` in the web app environment. Set the same non-empty `AUDIO_ANALYSIS_TOKEN` in both services outside local development.

```bash
pytest services/audio-analysis/tests
```

The current estimates are evidence for interpretation, not studio-grade musicological measurements. Vocal prominence is an acoustic proxy rather than source separation, section labels are inferred, and confidence values describe analyzer stability rather than creator intent.
