"""
Shared LLM client (Session 1). Google AI Studio exposes an OpenAI-compatible API for
Gemini, so we reuse the `openai` SDK and just point it at Google's base_url with a
Gemini API key.
"""
from openai import OpenAI

from config import GOOGLE_API_KEY, GOOGLE_BASE_URL

_client = None


def get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=GOOGLE_API_KEY, base_url=GOOGLE_BASE_URL)
    return _client
