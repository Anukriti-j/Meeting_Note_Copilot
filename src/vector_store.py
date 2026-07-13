"""
Chunking + embeddings + vector store (Session 3).

Chroma persistent collection, cosine similarity, local sentence-transformers embeddings
(no extra API key). Each meeting is split into several chunks (summary, decisions,
transcript windows) so retrieval can point at the specific bit of a meeting that
answers a question, not just "the whole meeting."
"""
import re
from datetime import date as date_cls

import chromadb
from sentence_transformers import SentenceTransformer

from config import MEETINGS_STORE_DIR, EMBEDDING_MODEL_NAME, RAG_TOP_K

_embedder = None
_client = None
_collection = None


def _get_embedder() -> SentenceTransformer:
    global _embedder
    if _embedder is None:
        _embedder = SentenceTransformer(EMBEDDING_MODEL_NAME)
    return _embedder


def _get_collection():
    global _client, _collection
    if _collection is None:
        _client = chromadb.PersistentClient(path=str(MEETINGS_STORE_DIR))
        _collection = _client.get_or_create_collection(
            name="meetings",
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


def _chunk_transcript(transcript: str, sentences_per_chunk: int = 3) -> list:
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", transcript) if s.strip()]
    return [
        " ".join(sentences[i : i + sentences_per_chunk])
        for i in range(0, len(sentences), sentences_per_chunk)
    ]


def add_meeting(summary: dict, meeting_date: str = None):
    """Embeds and stores the summary, decisions, and transcript chunks for one meeting."""
    meeting_id = summary["meeting_id"]
    meeting_date = meeting_date or str(date_cls.today())

    chunks, metadatas, ids = [], [], []

    chunks.append(f"Summary: {summary['summary']}")
    metadatas.append({"meeting_id": meeting_id, "date": meeting_date, "chunk_type": "summary"})

    for i, decision in enumerate(summary.get("decisions", [])):
        chunks.append(f"Decision: {decision}")
        metadatas.append({"meeting_id": meeting_id, "date": meeting_date, "chunk_type": "decision"})

    for i, item in enumerate(summary.get("action_items", [])):
        text = f"Action item: {item['owner']} will {item['task']}"
        if item.get("due_date"):
            text += f" (due {item['due_date']})"
        chunks.append(text)
        metadatas.append({"meeting_id": meeting_id, "date": meeting_date, "chunk_type": "action_item"})

    for chunk in _chunk_transcript(summary.get("transcript", "")):
        chunks.append(chunk)
        metadatas.append({"meeting_id": meeting_id, "date": meeting_date, "chunk_type": "transcript"})

    ids = [f"{meeting_id}::{i}" for i in range(len(chunks))]
    embeddings = _get_embedder().encode(chunks).tolist()

    collection = _get_collection()
    # Re-ingesting the same meeting_id replaces its old chunks rather than duplicating them.
    existing = collection.get(where={"meeting_id": meeting_id})
    if existing["ids"]:
        collection.delete(ids=existing["ids"])
    collection.add(ids=ids, embeddings=embeddings, documents=chunks, metadatas=metadatas)
    return len(chunks)


def query(text: str, top_k: int = RAG_TOP_K) -> list:
    """Returns top_k chunks as dicts with a cosine similarity score in [0, 1] (1 = identical)."""
    collection = _get_collection()
    if collection.count() == 0:
        return []
    embedding = _get_embedder().encode([text]).tolist()
    result = collection.query(query_embeddings=embedding, n_results=min(top_k, collection.count()))

    hits = []
    for doc, meta, distance in zip(result["documents"][0], result["metadatas"][0], result["distances"][0]):
        similarity = 1 - distance  # chroma's "cosine" space reports distance = 1 - cosine_similarity
        hits.append({"text": doc, "similarity": round(similarity, 3), **meta})
    return hits


def get_action_items(meeting_id: str) -> list:
    """Exact metadata lookup, not semantic search -- a meeting's own action items must
    all come back regardless of how large or topically crowded the store gets."""
    collection = _get_collection()
    result = collection.get(
        where={"$and": [{"meeting_id": meeting_id}, {"chunk_type": "action_item"}]}
    )
    return result["documents"]


def list_meeting_ids() -> list:
    collection = _get_collection()
    if collection.count() == 0:
        return []
    metadatas = collection.get()["metadatas"]
    return sorted({m["meeting_id"] for m in metadatas})
