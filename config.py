"""
Central config, loaded from environment variables (Session 1: no keys hardcoded/committed).
"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

ROOT_DIR = Path(__file__).resolve().parent
DATA_DIR = ROOT_DIR / "data"
AUDIO_DIR = DATA_DIR / "audio"
SEED_TRANSCRIPTS_DIR = DATA_DIR / "seed_transcripts"
MEETINGS_STORE_DIR = DATA_DIR / "meetings_store"
ACTION_ITEMS_DIR = DATA_DIR / "action_items"
CALENDAR_DIR = DATA_DIR / "calendar"
LOGS_DIR = ROOT_DIR / "logs"

# Google AI Studio exposes an OpenAI-compatible endpoint for Gemini, so we reuse the
# `openai` SDK and just point it at Google's base_url with a Gemini API key.
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")
GOOGLE_BASE_URL = os.environ.get("GOOGLE_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai/")
GOOGLE_MODEL = os.environ.get("GOOGLE_MODEL", "gemini-flash-lite-latest")

# Temperatures are chosen deliberately per call-site, not left at library defaults.
SUMMARY_TEMPERATURE = float(os.environ.get("SUMMARY_TEMPERATURE", "0.2"))
AGENT_TEMPERATURE = float(os.environ.get("AGENT_TEMPERATURE", "0.0"))
RAG_TEMPERATURE = float(os.environ.get("RAG_TEMPERATURE", "0.1"))

WHISPER_MODEL_SIZE = os.environ.get("WHISPER_MODEL_SIZE", "base")

RAG_TOP_K = int(os.environ.get("RAG_TOP_K", "10"))
# Cosine similarity below this means "not similar enough to answer from" -> refuse.
RAG_MIN_SIMILARITY = float(os.environ.get("RAG_MIN_SIMILARITY", "0.35"))

MAX_ITERATIONS = int(os.environ.get("MAX_ITERATIONS", "5"))

EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"

for _dir in (AUDIO_DIR, SEED_TRANSCRIPTS_DIR, MEETINGS_STORE_DIR, ACTION_ITEMS_DIR, CALENDAR_DIR, LOGS_DIR):
    _dir.mkdir(parents=True, exist_ok=True)
