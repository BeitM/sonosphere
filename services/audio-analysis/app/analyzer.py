from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import librosa
import numpy as np

TARGET_SAMPLE_RATE = 22_050
HOP_LENGTH = 512
EPSILON = 1e-9

KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
MAJOR_PROFILE = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR_PROFILE = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


class AudioAnalysisError(ValueError):
    pass


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    if not np.isfinite(value):
        return low
    return float(min(high, max(low, value)))


def _scalar(value: object) -> float:
    array = np.asarray(value, dtype=float).reshape(-1)
    return float(array[0]) if array.size else 0.0


def _load_audio(path: Path) -> tuple[np.ndarray, int]:
    try:
        audio, sample_rate = librosa.load(path, sr=TARGET_SAMPLE_RATE, mono=True)
    except Exception as first_error:
        ffmpeg = shutil.which("ffmpeg")
        if not ffmpeg:
            raise AudioAnalysisError(
                "The file could not be decoded. Install FFmpeg for MP3, M4A, and other compressed formats."
            ) from first_error
        converted = path.with_suffix(".decoded.wav")
        try:
            subprocess.run(
                [ffmpeg, "-v", "error", "-y", "-i", str(path), "-ac", "1", "-ar", str(TARGET_SAMPLE_RATE), str(converted)],
                check=True,
                capture_output=True,
                timeout=90,
            )
            audio, sample_rate = librosa.load(converted, sr=TARGET_SAMPLE_RATE, mono=True)
        except (subprocess.SubprocessError, OSError, ValueError) as conversion_error:
            raise AudioAnalysisError("The uploaded audio could not be decoded.") from conversion_error

    audio = np.nan_to_num(audio, copy=False)
    audio, _ = librosa.effects.trim(audio, top_db=55)
    if audio.size < sample_rate:
        raise AudioAnalysisError("The recording must contain at least one second of audible audio.")
    return audio, sample_rate


def _estimate_key(chroma: np.ndarray) -> tuple[str | None, str, float]:
    profile = np.mean(chroma, axis=1)
    if float(np.sum(profile)) <= EPSILON:
        return None, "unknown", 0.0

    scores: list[tuple[float, int, str]] = []
    for root in range(12):
        major_score = float(np.corrcoef(profile, np.roll(MAJOR_PROFILE, root))[0, 1])
        minor_score = float(np.corrcoef(profile, np.roll(MINOR_PROFILE, root))[0, 1])
        scores.append((major_score if np.isfinite(major_score) else -1.0, root, "major"))
        scores.append((minor_score if np.isfinite(minor_score) else -1.0, root, "minor"))
    scores.sort(key=lambda item: item[0], reverse=True)
    best, second = scores[0], scores[1]
    confidence = _clamp((best[0] - second[0]) * 2.5 + max(best[0], 0.0) * 0.45)
    return KEY_NAMES[best[1]], best[2], confidence


def _describe_section(energy: float, tension: float, brightness: float, rhythm: float) -> str:
    energy_text = "high-energy" if energy > 0.68 else "restrained" if energy < 0.35 else "moderate-energy"
    texture_text = "bright" if brightness > 0.58 else "dark" if brightness < 0.34 else "balanced"
    tension_text = "tense" if tension > 0.65 else "settled" if tension < 0.35 else "suspended"
    rhythm_text = "rhythmically active" if rhythm > 0.62 else "rhythmically sparse" if rhythm < 0.3 else "steadily pulsed"
    return f"A {energy_text}, {texture_text}, {tension_text}, and {rhythm_text} region measured from the recording."


def _section_boundaries(chroma: np.ndarray, mfcc: np.ndarray, duration: float) -> list[int]:
    frame_count = min(chroma.shape[1], mfcc.shape[1])
    desired = int(np.clip(round(duration / 45.0), 3, 6))
    if frame_count < desired * 8:
        return np.linspace(0, frame_count, desired + 1, dtype=int).tolist()
    features = np.vstack([librosa.util.normalize(chroma[:, :frame_count], axis=1), librosa.util.normalize(mfcc[:8, :frame_count], axis=1)])
    try:
        boundaries = librosa.segment.agglomerative(features, k=desired).astype(int).tolist()
        return sorted(set([0, *boundaries, frame_count]))
    except (ValueError, np.linalg.LinAlgError):
        return np.linspace(0, frame_count, desired + 1, dtype=int).tolist()


def analyze_audio(path: str | Path) -> dict[str, object]:
    audio, sample_rate = _load_audio(Path(path))
    duration = float(librosa.get_duration(y=audio, sr=sample_rate))

    rms = librosa.feature.rms(y=audio, hop_length=HOP_LENGTH)[0]
    rms_db = librosa.amplitude_to_db(np.maximum(rms, EPSILON), ref=1.0)
    onset = librosa.onset.onset_strength(y=audio, sr=sample_rate, hop_length=HOP_LENGTH)
    tempo_value, beat_frames = librosa.beat.beat_track(
        onset_envelope=onset,
        sr=sample_rate,
        hop_length=HOP_LENGTH,
    )
    tempo = _scalar(tempo_value)
    beat_frames = np.asarray(beat_frames, dtype=int)

    chroma = librosa.feature.chroma_stft(y=audio, sr=sample_rate, hop_length=HOP_LENGTH)
    mfcc = librosa.feature.mfcc(y=audio, sr=sample_rate, n_mfcc=13, hop_length=HOP_LENGTH)
    centroid = librosa.feature.spectral_centroid(y=audio, sr=sample_rate, hop_length=HOP_LENGTH)[0]
    bandwidth = librosa.feature.spectral_bandwidth(y=audio, sr=sample_rate, hop_length=HOP_LENGTH)[0]
    flatness = librosa.feature.spectral_flatness(y=audio, hop_length=HOP_LENGTH)[0]
    harmonic, percussive = librosa.effects.hpss(audio)

    key, mode, key_confidence = _estimate_key(chroma)
    mean_db = float(np.mean(rms_db))
    energy = _clamp((mean_db + 48.0) / 38.0)
    dynamic_db = float(np.percentile(rms_db, 95) - np.percentile(rms_db, 10))
    dynamic_range = _clamp(dynamic_db / 38.0)
    brightness = _clamp(float(np.mean(centroid)) / (sample_rate * 0.24))
    bandwidth_score = _clamp(float(np.mean(bandwidth)) / (sample_rate * 0.28))
    onset_peak = float(np.percentile(onset, 95)) if onset.size else 0.0
    rhythmic_intensity = _clamp((float(np.mean(onset)) / (onset_peak + EPSILON)) * 2.2)
    onset_rate = float(len(librosa.onset.onset_detect(onset_envelope=onset, sr=sample_rate, hop_length=HOP_LENGTH))) / max(duration, 1.0)
    density = _clamp(0.6 * bandwidth_score + 0.4 * min(onset_rate / 4.0, 1.0))
    harmonic_ratio = float(np.mean(np.square(harmonic))) / (float(np.mean(np.square(audio))) + EPSILON)
    vocal_prominence = _clamp((harmonic_ratio - 0.28) / 0.55)
    instability = _clamp(float(np.std(onset)) / (float(np.mean(onset)) + EPSILON) / 3.0)
    tension = _clamp(0.35 * (1.0 if mode == "minor" else 0.35) + 0.35 * instability + 0.3 * dynamic_range)
    valence = _clamp((0.64 if mode == "major" else 0.38 if mode == "minor" else 0.5) + (brightness - 0.5) * 0.22)

    if beat_frames.size > 4:
        intervals = np.diff(librosa.frames_to_time(beat_frames, sr=sample_rate, hop_length=HOP_LENGTH))
        tempo_confidence = _clamp(1.0 - float(np.std(intervals) / (np.mean(intervals) + EPSILON)))
    else:
        tempo_confidence = 0.2 if tempo > 0 else 0.0

    frame_count = min(len(rms), len(onset), len(centroid), chroma.shape[1], mfcc.shape[1])
    boundaries = _section_boundaries(chroma[:, :frame_count], mfcc[:, :frame_count], duration)
    raw_sections: list[dict[str, object]] = []
    for index, (start, end) in enumerate(zip(boundaries, boundaries[1:])):
        end = max(end, start + 1)
        local_rms = rms[start:end]
        local_onset = onset[start:end]
        local_centroid = centroid[start:end]
        local_energy = _clamp((float(np.mean(librosa.amplitude_to_db(np.maximum(local_rms, EPSILON), ref=1.0))) + 48.0) / 38.0)
        local_brightness = _clamp(float(np.mean(local_centroid)) / (sample_rate * 0.24))
        local_rhythm = _clamp((float(np.mean(local_onset)) / (onset_peak + EPSILON)) * 2.2)
        local_tension = _clamp(0.45 * local_energy + 0.3 * local_rhythm + 0.25 * instability)
        raw_sections.append({
            "id": f"section-{index + 1}",
            "label": "unknown",
            "startTime": float(librosa.frames_to_time(start, sr=sample_rate, hop_length=HOP_LENGTH)),
            "endTime": min(duration, float(librosa.frames_to_time(end, sr=sample_rate, hop_length=HOP_LENGTH))),
            "energy": local_energy,
            "tension": local_tension,
            "loudness": local_energy,
            "brightness": local_brightness,
            "rhythmicIntensity": local_rhythm,
            "vocalIntensity": vocal_prominence,
            "description": _describe_section(local_energy, local_tension, local_brightness, local_rhythm),
        })

    if raw_sections:
        raw_sections[0]["label"] = "opening"
        raw_sections[-1]["label"] = "ending"
        for section in raw_sections[1:-1]:
            section["label"] = "development"

    onset_frames = librosa.onset.onset_detect(onset_envelope=onset, sr=sample_rate, hop_length=HOP_LENGTH)
    candidates = sorted(onset_frames, key=lambda frame: float(onset[min(frame, len(onset) - 1)]), reverse=True)
    selected: list[int] = []
    minimum_gap = int(5.0 * sample_rate / HOP_LENGTH)
    for frame in candidates:
        if all(abs(int(frame) - prior) >= minimum_gap for prior in selected):
            selected.append(int(frame))
        if len(selected) == 3:
            break
    notable_moments = []
    for frame in sorted(selected):
        before = float(np.mean(rms[max(0, frame - 8):frame])) if frame > 0 else float(rms[0])
        after = float(np.mean(rms[frame:min(len(rms), frame + 8)]))
        change = (after - before) / (max(before, after) + EPSILON)
        moment_type = "instrument_entry" if change > 0.22 else "sudden_silence" if change < -0.22 else "texture_change"
        notable_moments.append({
            "time": float(librosa.frames_to_time(frame, sr=sample_rate, hop_length=HOP_LENGTH)),
            "type": moment_type,
            "intensity": _clamp(float(onset[frame]) / (onset_peak + EPSILON)),
            "description": "A strong measured onset with a substantial local change in level or texture.",
        })

    result: dict[str, object] = {
        "durationSeconds": duration,
        "mode": mode,
        "overall": {
            "energy": energy,
            "valence": valence,
            "tension": tension,
            "brightness": brightness,
            "density": density,
            "rhythmicIntensity": rhythmic_intensity,
            "vocalProminence": vocal_prominence,
            "dynamicRange": dynamic_range,
        },
        "sections": raw_sections,
        "notableMoments": notable_moments,
        "confidence": {
            "tempo": tempo_confidence,
            "key": key_confidence,
            "sectionDetection": _clamp(0.45 + min(duration / 600.0, 0.25)),
            "emotionalFeatures": 0.62,
        },
        "provider": "Sonosphere librosa analyzer v1",
    }
    if tempo > 0:
        result["tempoBpm"] = tempo
    if key:
        result["key"] = key
    return result
