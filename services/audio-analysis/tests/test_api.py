from __future__ import annotations

import io
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from fastapi.testclient import TestClient

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))

from app.main import app  # noqa: E402


def _wav_bytes() -> bytes:
    sample_rate = 22_050
    duration = 3
    time = np.arange(sample_rate * duration) / sample_rate
    audio = (0.25 * np.sin(2 * np.pi * 220 * time)).astype(np.float32)
    buffer = io.BytesIO()
    sf.write(buffer, audio, sample_rate, format="WAV")
    return buffer.getvalue()


def test_health_and_analyze_contract() -> None:
    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok"}
        response = client.post("/analyze", files={"audio": ("tone.wav", _wav_bytes(), "audio/wav")})

    assert response.status_code == 200
    result = response.json()
    assert result["durationSeconds"] >= 2.9
    assert result["provider"] == "Sonosphere librosa analyzer v1"
    assert len(result["sections"]) >= 3
    assert result.get("tempoBpm", 1) > 0
    assert result.get("key", "unknown") is not None


def test_shared_token_is_enforced(monkeypatch) -> None:
    monkeypatch.setenv("AUDIO_ANALYSIS_TOKEN", "test-secret")
    with TestClient(app) as client:
        unauthorized = client.post("/analyze", files={"audio": ("tone.wav", _wav_bytes(), "audio/wav")})
        authorized = client.post(
            "/analyze",
            headers={"Authorization": "Bearer test-secret"},
            files={"audio": ("tone.wav", _wav_bytes(), "audio/wav")},
        )

    assert unauthorized.status_code == 401
    assert authorized.status_code == 200
