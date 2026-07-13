"""
Grounded question answering over past meetings (Session 3 + Session 2).

The system prompt hard-constrains the model to the retrieved context, and a similarity
threshold decides *before* calling the LLM whether we even have relevant context --
if not, we skip the call entirely and return "I can't find this in the provided context."
"""
from config import GOOGLE_MODEL, RAG_TEMPERATURE, RAG_TOP_K, RAG_MIN_SIMILARITY
from src.llm_client import get_client
from src.logging_utils import stage_timer, log_tokens
from src.vector_store import query as vector_query

CANT_FIND = "I can't find this in the provided context."

SYSTEM_PROMPT = """You answer questions about past meetings using ONLY the context chunks provided below.
Each chunk is tagged with the meeting it came from. Cite the meeting_id for every claim you make,
like "(from standup-2026-07-08)". If the context does not contain the answer, respond with exactly:
"I can't find this in the provided context."
Never use outside knowledge or guess."""


def _retrieve(question: str, run_id: str, top_k: int) -> list:
    with stage_timer(run_id, "retrieval", question=question) as record:
        hits = vector_query(question, top_k=top_k)
        record["num_hits"] = len(hits)
        record["top_similarity"] = hits[0]["similarity"] if hits else 0.0
    return hits


def _build_context(hits: list) -> str:
    return "\n\n".join(
        f"[{h['meeting_id']} | {h['chunk_type']} | similarity={h['similarity']}]\n{h['text']}" for h in hits
    )


def ask(question: str, run_id: str, top_k: int = RAG_TOP_K) -> dict:
    hits = _retrieve(question, run_id, top_k)

    if not hits or hits[0]["similarity"] < RAG_MIN_SIMILARITY:
        return {"answer": CANT_FIND, "citations": [], "hits": hits}

    context_block = _build_context(hits)

    with stage_timer(run_id, "llm", purpose="rag_qa") as _record:
        response = get_client().chat.completions.create(
            model=GOOGLE_MODEL,
            max_tokens=1024,
            temperature=RAG_TEMPERATURE,
            # This is grounded synthesis, not a task needing deep reasoning -- Gemini's
            # internal "thinking" tokens count against max_tokens, and were silently
            # eating the whole budget before any visible answer got written (finish_reason
            # came back "length" with a truncated answer). Disabling it fixed both latency
            # and truncation.
            extra_body={"reasoning_effort": "none"},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Context:\n{context_block}\n\nQuestion: {question}"},
            ],
        )
    log_tokens(run_id, "rag_qa", response.usage.prompt_tokens, response.usage.completion_tokens)

    answer_text = response.choices[0].message.content.strip()
    citations = sorted({h["meeting_id"] for h in hits})
    return {"answer": answer_text, "citations": citations, "hits": hits}


def ask_stream(question: str, run_id: str, top_k: int = RAG_TOP_K):
    """
    Same grounding/threshold behavior as ask(), but yields the answer incrementally:
    {"delta": "..."} chunks while text is arriving, then a final
    {"done": True, "citations": [...], "hits": [...]} once the whole answer is in.
    """
    hits = _retrieve(question, run_id, top_k)

    if not hits or hits[0]["similarity"] < RAG_MIN_SIMILARITY:
        yield {"delta": CANT_FIND}
        yield {"done": True, "citations": [], "hits": hits}
        return

    context_block = _build_context(hits)

    prompt_tokens = completion_tokens = 0
    with stage_timer(run_id, "llm", purpose="rag_qa") as _record:
        stream = get_client().chat.completions.create(
            model=GOOGLE_MODEL,
            max_tokens=1024,
            temperature=RAG_TEMPERATURE,
            extra_body={"reasoning_effort": "none"},
            stream=True,
            stream_options={"include_usage": True},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Context:\n{context_block}\n\nQuestion: {question}"},
            ],
        )
        for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield {"delta": chunk.choices[0].delta.content}
            if chunk.usage:
                prompt_tokens = chunk.usage.prompt_tokens
                completion_tokens = chunk.usage.completion_tokens
    log_tokens(run_id, "rag_qa", prompt_tokens, completion_tokens)

    citations = sorted({h["meeting_id"] for h in hits})
    yield {"done": True, "citations": citations, "hits": hits}
