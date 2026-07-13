# Meeting-notes copilot

Turns a short meeting recording into a searchable, structured record: transcript ->
structured JSON summary (summary + action items) -> vector store, with grounded Q&A
across past meetings and an agent that files action items through real MCP tools.

Go through this demo video of project for quick overview:
https://drive.google.com/file/d/1CQi1fobYlkLE0BDGHlw0Lm79QpmAy21-/view?usp=sharing

Built for the GenAI Assignments brief, Option 1.

## Architecture

```
                 ┌────────────┐   ┌────────────────┐   ┌────────────────┐
 audio (.wav) -> │ faster-    │ ->│ Gemini (via    │ ->│ Chroma vector  │
                 │ whisper STT│   │ Google AI      │   │ store          │
                 │            │   │ structured     │   │ (chunks + meta)│
                 │            │   │ JSON summary)  │   │                │
                 └────────────┘   └────────────────┘   └───────┬────────┘
                                                                │
                                            top-k + similarity  │
                                            threshold retrieval │
                                                                v
                                                     ┌────────────────────┐
                       "What did we decide about --> │ Gemini (grounded   │ --> cited answer
                        the billing migration?"      │ QA, context-only)  │     or "I can't find
                                                     └────────────────────┘      this in context"

                 ┌───────────────────────────┐      ┌─────────────────────────┐
 action items -> │ Gemini tool-calling agent │ <--> │ MCP server (stdio)      │
                 │ (Thought/Action/          │      │ save_action_items       │
                 │  Observation,             │      │ create_calendar_event   │
                 │  MAX_ITERATIONS, HITL)    │      │                         │
                 └───────────────────────────┘      └─────────────────────────┘
```

**Patterns used deliberately** (Session 5): ingestion (`src/pipeline.py`) is a plain
**sequential pipeline** — STT -> summarize -> store, fixed order, no branching. Filing
action items (`src/agent.py`) is a **ReAct-style tool-calling agent** — the model decides
*which* tools to call and with what arguments, bounded by `MAX_ITERATIONS`.

## Setup

Requires **Python 3.10+** (the `mcp` SDK needs it). If your system Python is older:

```bash
brew install python@3.12
```

Then, from this directory:

```bash
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env and set GOOGLE_API_KEY
```

The first run downloads the faster-whisper model (`base` by default) and the
`all-MiniLM-L6-v2` sentence-transformers embedding model — both local and free, but
they need internet access once.

## Web UI (recommended way to use this)

On top of the CLI, this project has a FastAPI backend (`api.py`) and a React frontend
(`frontend/`) that wrap the same pipeline as a chat-style UI, with pages for ingesting
meetings, asking questions (with live streaming answers), running the agent, and
viewing action items / calendar events / per-stage logs.

Requires Node.js in addition to the Python setup above. First time only:

```bash
cd frontend
npm install
cd ..
```

Then, from the project root, with the Python venv already set up as above:

```bash
./start.sh
```

This starts the FastAPI backend on `:8000` and the Vite dev server on `:5173`. Open
**http://localhost:5173** in a browser. Press Ctrl+C to stop both.

If you change `.env` or any Python file that isn't auto-reloaded, restart with Ctrl+C
and `./start.sh` again.

## Run it end to end (CLI)

```bash
# 1. Seed the vector store with 4 sample meetings (see "About the sample data" below)
python cli.py seed

# 2. Ask grounded questions across past meetings
python cli.py ask "What did we decide about the billing migration?"
python cli.py ask "What's the marketing budget for next quarter?"   # -> "I can't find this in the provided context."

# 3. Ingest your own recording (2-3 min .wav/.mp3)
python cli.py ingest --audio data/audio/my_standup.wav --meeting-id standup-2026-07-10

# 4. File a meeting's action items through the agent + MCP tools
python cli.py agent --meeting-id standup-2026-07-08
#   -> prompts y/N before each tool call; pass --auto-approve to skip for a demo recording

# 5. See what got written
cat data/action_items/standup-2026-07-08.md
ls data/calendar/

# 6. Run the evaluation set
python -m eval.run_eval
```

Every stage logs its timing and token counts to `logs/run_log.jsonl` as it runs (and
prints a one-line summary to stdout) — that's `stt_ms`, `llm_ms`, `total_ms`-equivalent
per stage, plus `input_tokens`/`output_tokens` for every model call.

## About the sample data

`data/seed_transcripts/*.txt` are four short, hand-written fake meetings (standup,
design review, sprint planning, retro) covering a recurring storyline — a billing
migration, a notifications-service design decision, and a couple of recurring action
items — so that cross-meeting retrieval has something real to chase. The brief explicitly allows pasted transcripts for the seed set, but
the top-level recording requirement should be a real one.

## Project layout

```
config.py              env-driven config (model, temperature, MAX_ITERATIONS, RAG params)
cli.py                 command-line entry point
api.py                 FastAPI backend wrapping the same pipeline as a REST + WebSocket API
start.sh                launches the backend (:8000) and frontend dev server (:5173) together
src/
  stt.py               faster-whisper transcription
  llm_client.py           shared Google AI Studio (Gemini) client
  summarizer.py         transcript -> structured JSON (function-calling, forced schema, few-shot)
  vector_store.py        chunking + embeddings + Chroma
  rag_qa.py               grounded Q&A with similarity-threshold refusal + citations + streaming
  mcp_server.py           MCP tools: save_action_items, create_calendar_event
  mcp_client.py           MCP stdio client used by the agent
  agent.py                 tool-calling loop (Thought/Action/Observation), HITL, iteration cap
  pipeline.py               orchestrates ingestion end to end
  logging_utils.py          per-stage timing + token-count logging
frontend/               React + TypeScript + Vite UI (Dashboard, Ingest, Ask, Agent, Logs, Action Items)
data/
  audio/                  put your own recordings here
  seed_transcripts/        sample fake meetings (see above)
  meetings_store/           Chroma's persistent DB (gitignored)
  action_items/             agent output: markdown action-item files
  calendar/                 agent output: .ics calendar events
eval/
  eval_set.json             8 QA pairs against the seeded meetings
  run_eval.py                runs them against the live pipeline and scores them
docs/
  DESIGN_NOTE.md             design note: architecture choice, a real failure, a tradeoff
logs/
  run_log.jsonl               timing + token log, one JSON object per line
```

## Mapping to the seven sessions

- **Session 1 (Foundations)** — `config.py` loads `GOOGLE_API_KEY` from `.env`
  (never committed); `src/agent.py` and `src/rag_qa.py` manage the `messages` array
  by hand; temperatures are chosen per call-site (`0.2` for summarization, `0.0` for
  the agent, `0.1` for RAG QA) in `config.py`.
- **Session 2 (Prompting)** — `src/summarizer.py` forces structured JSON output via a
  function-calling schema (OpenAI-compatible, served directly by Google AI Studio) with a fixed
  `parameters` schema, and includes one worked few-shot example to fix the expected
  granularity of summaries/action items.
- **Session 3 (RAG)** — `src/vector_store.py` chunks each meeting (summary, decisions,
  action items, transcript windows), embeds with `all-MiniLM-L6-v2`, stores in Chroma;
  `src/rag_qa.py` does top-k retrieval with a similarity threshold and cites the source
  meeting_id in every answer.
- **Session 4 (Agents)** — `src/agent.py` is a Thought/Action/Observation loop with
  correct `tool_call_id` <-> `role: "tool"` result pairing, every tool call logged via
  `log_tool_call`, and a `MAX_ITERATIONS` guard.
- **Session 5 (Architectures)** — sequential pipeline for ingestion vs. a tool-calling
  agent for filing action items (see "Architecture" above for the reasoning).
- **Session 6 (MCP)** — `src/mcp_server.py` exposes `save_action_items` and
  `create_calendar_event` as real MCP tools over stdio; `src/agent.py` consumes them
  through `src/mcp_client.py`, not as hard-coded function calls.
- **Session 7 (Audio/Visual)** — `src/stt.py` wires faster-whisper into the ingestion
  pipeline, with `stt_ms` (and audio duration/language) logged per call.

## Safety notes

- Anything that writes to disk (action items, calendar files) goes through the MCP
  tool layer, is confirmed interactively by default (`python cli.py agent`), and can
  only run `MAX_ITERATIONS` times before the loop stops itself.
