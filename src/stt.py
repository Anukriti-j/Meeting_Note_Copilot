"""
Speech-to-text (Session 7). Local faster-whisper -- no extra API key needed.
"""
from faster_whisper import WhisperModel

from config import WHISPER_MODEL_SIZE
from src.logging_utils import stage_timer

_model = None


def _get_model() -> WhisperModel:
    global _model
    if _model is None:
        # int8 on CPU keeps this usable on a laptop with no GPU.
        _model = WhisperModel(WHISPER_MODEL_SIZE, device="cpu", compute_type="int8")
    return _model


def transcribe(audio_path: str, run_id: str) -> str:
    """Transcribes a short (2-3 min) recording to plain text."""
    with stage_timer(run_id, "stt", audio_path=str(audio_path)) as record:
        model = _get_model()
        segments, info = model.transcribe(str(audio_path), beam_size=5)
        text = " ".join(segment.text.strip() for segment in segments)
        record["language"] = info.language
        record["duration_s"] = round(info.duration, 1)
    return text.strip()
