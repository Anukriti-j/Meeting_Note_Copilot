"""
CLI entry point.

Examples:
    python cli.py seed
    python cli.py ingest --audio data/audio/standup.wav --meeting-id standup-2026-07-10
    python cli.py ask "What did we decide about the billing migration?"
    python cli.py agent --meeting-id standup-2026-07-10
    python cli.py list-meetings
"""
import asyncio
import json

import click

from config import SEED_TRANSCRIPTS_DIR
from src.logging_utils import new_run_id
from src.pipeline import ingest_audio, ingest_transcript
from src.rag_qa import ask as rag_ask
from src.vector_store import list_meeting_ids, get_action_items
from src.agent import run_agent


@click.group()
def cli():
    pass


@cli.command()
def seed():
    """Ingests the sample transcripts in data/seed_transcripts/ so RAG has something to work with."""
    files = sorted(SEED_TRANSCRIPTS_DIR.glob("*.txt"))
    if not files:
        click.echo("No seed transcripts found in data/seed_transcripts/.")
        return
    for path in files:
        meeting_id = path.stem
        transcript = path.read_text()
        summary = ingest_transcript(transcript, meeting_id)
        click.echo(f"Seeded '{meeting_id}': {summary['summary']}")


@cli.command()
@click.option("--audio", required=True, type=click.Path(exists=True), help="Path to a 2-3 min recording.")
@click.option("--meeting-id", required=True, help="Unique id for this meeting, e.g. standup-2026-07-10.")
@click.option("--date", default=None, help="ISO date for this meeting (defaults to today).")
def ingest(audio, meeting_id, date):
    """Transcribes, summarizes, and stores a real meeting recording."""
    summary = ingest_audio(audio, meeting_id, date)
    click.echo(json.dumps(summary, indent=2))


@cli.command()
@click.argument("question")
@click.option("--top-k", default=None, type=int)
def ask(question, top_k):
    """Asks a grounded question across all stored meetings."""
    kwargs = {"top_k": top_k} if top_k else {}
    result = rag_ask(question, run_id=new_run_id(), **kwargs)
    click.echo(f"\nAnswer: {result['answer']}")
    if result["citations"]:
        click.echo(f"Cited meetings: {', '.join(result['citations'])}")


@cli.command()
@click.option("--meeting-id", required=True)
@click.option("--auto-approve", is_flag=True, help="Skip the HITL confirmation prompt for tool calls.")
def agent(meeting_id, auto_approve):
    """Runs the tool-calling agent to file a meeting's action items via MCP."""
    ids = list_meeting_ids()
    if meeting_id not in ids:
        click.echo(f"Unknown meeting_id '{meeting_id}'. Known: {ids}")
        return

    action_item_texts = get_action_items(meeting_id)
    if not action_item_texts:
        click.echo("No action items found for that meeting.")
        return

    meeting_summary = {"meeting_id": meeting_id, "action_items": action_item_texts}
    result = asyncio.run(run_agent(meeting_summary, run_id=new_run_id(), auto_approve=auto_approve))
    click.echo(f"\nAgent result: {result}")


@cli.command(name="list-meetings")
def list_meetings():
    """Lists the meeting_ids currently in the vector store."""
    for meeting_id in list_meeting_ids():
        click.echo(meeting_id)


if __name__ == "__main__":
    cli()
