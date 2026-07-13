"""
End-to-end orchestration: audio/text -> transcript -> structured summary -> vector store.

This is the "sequential pipeline" architecture pattern (Session 5) for ingestion:
each stage's output feeds the next, in a fixed order, with no branching or planning.
"""
from datetime import date

from src.logging_utils import new_run_id, stage_timer
from src.stt import transcribe
from src.summarizer import summarize
from src.vector_store import add_meeting


def ingest_audio(audio_path: str, meeting_id: str, meeting_date: str = None) -> dict:
    run_id = new_run_id()
    transcript = transcribe(audio_path, run_id)
    return _summarize_and_store(transcript, meeting_id, meeting_date, run_id)


def ingest_transcript(transcript: str, meeting_id: str, meeting_date: str = None) -> dict:
    """For seeding the store from pasted/pre-existing transcripts (no STT stage)."""
    run_id = new_run_id()
    return _summarize_and_store(transcript, meeting_id, meeting_date, run_id)


def _summarize_and_store(transcript: str, meeting_id: str, meeting_date: str, run_id: str) -> dict:
    # Resolved once here so summarize() (date-anchors relative due dates like "by Friday")
    # and add_meeting() (stores it as metadata) agree on the same date.
    meeting_date = meeting_date or str(date.today())
    summary = summarize(transcript, run_id, meeting_id, meeting_date)
    with stage_timer(run_id, "store", meeting_id=meeting_id) as record:
        num_chunks = add_meeting(summary, meeting_date)
        record["num_chunks"] = num_chunks
    summary["run_id"] = run_id
    return summary
