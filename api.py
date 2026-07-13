"""
FastAPI server exposing the meeting-notes-copilot backend as a REST API.
Run with: uvicorn api:app --reload --port 8000
"""
import asyncio
import json
import os
import sys
import tempfile
import uuid
from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import (
    ACTION_ITEMS_DIR,
    AUDIO_DIR,
    CALENDAR_DIR,
    SEED_TRANSCRIPTS_DIR,
)
from src.logging_utils import new_run_id
from src.pipeline import ingest_audio, ingest_transcript
from src.rag_qa import ask as rag_ask, ask_stream as rag_ask_stream
from src.vector_store import get_action_items, list_meeting_ids


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: nothing special needed
    yield
    # Shutdown: nothing special needed


app = FastAPI(title="Meeting Notes Copilot API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/meetings")
async def list_meetings():
    ids = list_meeting_ids()
    meetings = []
    for mid in ids:
        action_items = get_action_items(mid)
        action_item_files = list(ACTION_ITEMS_DIR.glob(f"{mid}.md"))
        meetings.append({
            "meeting_id": mid,
            "num_action_items": len(action_items),
            "has_action_file": len(action_item_files) > 0,
        })
    return {"meetings": meetings}


@app.get("/api/meetings/{meeting_id}")
async def get_meeting(meeting_id: str):
    ids = list_meeting_ids()
    if meeting_id not in ids:
        raise HTTPException(status_code=404, detail=f"Meeting '{meeting_id}' not found")

    action_items = get_action_items(meeting_id)
    action_file = ACTION_ITEMS_DIR / f"{meeting_id}.md"
    action_file_content = action_file.read_text() if action_file.exists() else None

    return {
        "meeting_id": meeting_id,
        "action_items": action_items,
        "action_file": action_file_content,
    }


@app.post("/api/ingest/text")
async def ingest_text(
    transcript: str = Form(...),
    meeting_id: str = Form(...),
    meeting_date: str = Form(default=None),
):
    try:
        summary = await asyncio.to_thread(
            ingest_transcript, transcript, meeting_id, meeting_date
        )
        return {"ok": True, "summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ingest/audio")
async def ingest_audio_file(
    file: UploadFile = File(...),
    meeting_id: str = Form(...),
    meeting_date: str = Form(default=None),
):
    suffix = Path(file.filename or "audio.wav").suffix or ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, dir=str(AUDIO_DIR)) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    try:
        summary = await asyncio.to_thread(ingest_audio, tmp_path, meeting_id, meeting_date)
        return {"ok": True, "summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        os.unlink(tmp_path)


@app.post("/api/seed")
async def seed():
    files = sorted(SEED_TRANSCRIPTS_DIR.glob("*.txt"))
    if not files:
        return {"ok": True, "seeded": 0, "message": "No seed transcripts found."}
    results = []
    for path in files:
        meeting_id = path.stem
        transcript = path.read_text()
        try:
            summary = await asyncio.to_thread(ingest_transcript, transcript, meeting_id)
            results.append({"meeting_id": meeting_id, "ok": True})
        except Exception as e:
            results.append({"meeting_id": meeting_id, "ok": False, "error": str(e)})
    return {"ok": True, "seeded": len(results), "results": results}


@app.post("/api/ask")
async def ask_question(
    question: str = Form(...),
    top_k: int = Form(default=10),
):
    run_id = new_run_id()
    try:
        result = await asyncio.to_thread(rag_ask, question, run_id, top_k=top_k)
        return {"ok": True, **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


_STREAM_DONE = object()


@app.websocket("/ws/ask")
async def ask_question_ws(websocket: WebSocket):
    """
    One question per connection: client sends {"question": "...", "top_k": 10},
    server sends a {"delta": "..."} message per chunk as the model streams it, then
    one {"done": true, "citations": [...], "hits": [...]} before closing.
    """
    await websocket.accept()
    try:
        payload = await websocket.receive_json()
        question = payload.get("question", "")
        top_k = payload.get("top_k", 10)
        run_id = new_run_id()

        gen = rag_ask_stream(question, run_id, top_k=top_k)
        while True:
            try:
                # next(gen, sentinel) avoids raising StopIteration across the thread
                # boundary -- asyncio disallows a bare StopIteration surfacing through
                # a Future/Task, so a raise-based loop here would break unpredictably.
                item = await asyncio.to_thread(next, gen, _STREAM_DONE)
            except Exception as e:  # noqa: BLE001 -- surfaced to the client as an error message
                await websocket.send_json({"error": str(e)})
                break
            if item is _STREAM_DONE:
                break
            await websocket.send_json(item)
    except WebSocketDisconnect:
        pass
    finally:
        try:
            await websocket.close()
        except RuntimeError:
            pass  # already closed


@app.post("/api/agent/{meeting_id}")
async def run_agent(meeting_id: str, auto_approve: bool = Form(default=True)):
    from src.agent import run_agent as agent_run
    from src.vector_store import list_meeting_ids as _ids

    ids = _ids()
    if meeting_id not in ids:
        raise HTTPException(status_code=404, detail=f"Meeting '{meeting_id}' not found")

    action_item_texts = get_action_items(meeting_id)
    if not action_item_texts:
        return {"ok": True, "result": "No action items found for that meeting.", "tool_calls": []}

    meeting_summary = {"meeting_id": meeting_id, "action_items": action_item_texts}
    run_id = new_run_id()

    try:
        result = await asyncio.to_thread(
            asyncio.run,
            agent_run(meeting_summary, run_id=run_id, auto_approve=auto_approve),
        )
        return {"ok": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/action-items")
async def list_action_items():
    files = sorted(ACTION_ITEMS_DIR.glob("*.md"), key=os.path.getmtime, reverse=True)
    items = []
    for f in files:
        content = f.read_text()
        items.append({
            "meeting_id": f.stem,
            "filename": f.name,
            "content": content,
        })
    return {"action_items": items}


@app.get("/api/calendar")
async def list_calendar():
    files = sorted(CALENDAR_DIR.glob("*.ics"), key=os.path.getmtime, reverse=True)
    return {"events": [{"filename": f.name, "content": f.read_text()} for f in files]}


@app.post("/api/calendar/{filename}/open")
async def open_calendar_event(filename: str):
    """
    Launches the .ics file with the OS's default calendar app (macOS `open`), instead
    of making the browser download it. This only makes sense because the backend and
    the browser are on the same machine here -- a hosted version of this app couldn't
    (and shouldn't) do this, since it would mean a server reaching into a client's OS.
    """
    if "/" in filename or "\\" in filename or filename != Path(filename).name:
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = CALENDAR_DIR / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail=f"No such calendar file: {filename}")

    opener = "open" if sys.platform == "darwin" else "xdg-open" if sys.platform.startswith("linux") else None
    if opener is None:
        raise HTTPException(status_code=501, detail=f"Auto-open not supported on {sys.platform}")

    proc = await asyncio.create_subprocess_exec(opener, str(path))
    await proc.wait()
    if proc.returncode != 0:
        raise HTTPException(status_code=500, detail=f"'{opener}' exited with code {proc.returncode}")
    return {"ok": True}


@app.get("/api/logs")
async def get_logs():
    log_path = Path("logs/run_log.jsonl")
    if not log_path.exists():
        return {"logs": []}
    lines = log_path.read_text().strip().split("\n")
    logs = []
    for line in lines[-100:]:  # last 100 entries
        try:
            logs.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return {"logs": logs}
