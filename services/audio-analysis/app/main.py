from __future__ import annotations

import hmac
import os
import re
import tempfile
from pathlib import Path

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile

from .analyzer import AudioAnalysisError, analyze_audio

MAX_AUDIO_BYTES = 25 * 1024 * 1024
CHUNK_BYTES = 1024 * 1024
ALLOWED_SUFFIXES = {".mp3", ".wav", ".m4a", ".flac"}

app = FastAPI(title="Sonosphere Audio Analysis", version="1.0.0")


def _authorize(authorization: str | None = Header(default=None)) -> None:
    expected = os.getenv("AUDIO_ANALYSIS_TOKEN", "").strip()
    if not expected:
        return
    supplied = authorization.removeprefix("Bearer ") if authorization else ""
    if not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze", dependencies=[Depends(_authorize)])
async def analyze(audio: UploadFile = File(...)) -> dict[str, object]:
    suffix = Path(audio.filename or "audio").suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(status_code=415, detail="Use MP3, WAV, M4A, or FLAC audio.")

    safe_stem = re.sub(r"[^a-zA-Z0-9_-]+", "-", Path(audio.filename or "audio").stem).strip("-") or "audio"
    with tempfile.TemporaryDirectory(prefix="sonosphere-audio-") as directory:
        path = Path(directory) / f"{safe_stem}{suffix}"
        total = 0
        with path.open("wb") as destination:
            while chunk := await audio.read(CHUNK_BYTES):
                total += len(chunk)
                if total > MAX_AUDIO_BYTES:
                    raise HTTPException(status_code=413, detail="Audio files must be 25 MB or smaller.")
                destination.write(chunk)
        if total == 0:
            raise HTTPException(status_code=400, detail="The uploaded file is empty.")
        try:
            return analyze_audio(path)
        except AudioAnalysisError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
        except Exception as error:
            raise HTTPException(status_code=422, detail="Audio analysis could not be completed.") from error
        finally:
            await audio.close()
