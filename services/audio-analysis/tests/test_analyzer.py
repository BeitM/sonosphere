from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import soundfile as sf

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))

from app.analyzer import analyze_audio  # noqa: E402


def test_analyzes_synthetic_click_track(tmp_path: Path) -> None:
    sample_rate = 22_050
    duration = 12
    audio = np.zeros(sample_rate * duration, dtype=np.float32)
    time = np.arange(audio.size) / sample_rate
    audio += 0.12 * np.sin(2 * np.pi * 220 * time).astype(np.float32)
    for second in np.arange(0, duration, 0.5):
        start = int(second * sample_rate)
        length = min(500, audio.size - start)
        audio[start:start + length] += np.hanning(length).astype(np.float32) * 0.8
    path = tmp_path / "click-track.wav"
    sf.write(path, audio, sample_rate)

    result = analyze_audio(path)

    assert result["provider"] == "Sonosphere librosa analyzer v1"
    assert 100 <= result["tempoBpm"] <= 140
    assert result["durationSeconds"] > 10
    assert len(result["sections"]) >= 3
    assert result["sections"][0]["label"] == "intro"
    assert result["sections"][-1]["label"] == "outro"
    assert all(0 <= value <= 1 for value in result["overall"].values())
