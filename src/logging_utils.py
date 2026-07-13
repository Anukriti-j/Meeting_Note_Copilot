"""
Per-stage timing + token-count logging (Session 1: watch cost/context budgets).

Each pipeline run gets one JSONL log line per stage in logs/run_log.jsonl, e.g.:
  {"run_id": "...", "stage": "stt", "stt_ms": 812, "meeting_id": "standup-01"}
  {"run_id": "...", "stage": "summarize", "llm_ms": 1340, "input_tokens": 812, "output_tokens": 210}
"""
import json
import time
import uuid
from contextlib import contextmanager

from config import LOGS_DIR

RUN_LOG_PATH = LOGS_DIR / "run_log.jsonl"


def new_run_id() -> str:
    return uuid.uuid4().hex[:12]


@contextmanager
def stage_timer(run_id: str, stage: str, **extra_fields):
    """Times a block and appends {stage}_ms plus any extra fields to the run log."""
    start = time.perf_counter()
    record = {"run_id": run_id, "stage": stage}
    record.update(extra_fields)
    try:
        yield record
    finally:
        elapsed_ms = round((time.perf_counter() - start) * 1000, 1)
        record[f"{stage}_ms"] = elapsed_ms
        _append(record)
        print(f"[{run_id}] {stage} took {elapsed_ms} ms " + _fmt_extra(record))


def log_tokens(run_id: str, stage: str, input_tokens: int, output_tokens: int):
    record = {
        "run_id": run_id,
        "stage": f"{stage}_tokens",
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": input_tokens + output_tokens,
    }
    _append(record)
    print(f"[{run_id}] {stage} tokens: in={input_tokens} out={output_tokens}")


def log_tool_call(run_id: str, tool_name: str, tool_input: dict, result_summary: str, iteration: int):
    record = {
        "run_id": run_id,
        "stage": "tool_call",
        "iteration": iteration,
        "tool_name": tool_name,
        "tool_input": tool_input,
        "result_summary": result_summary,
    }
    _append(record)
    print(f"[{run_id}] iter={iteration} tool_call={tool_name} input={tool_input} -> {result_summary}")


def _append(record: dict):
    with open(RUN_LOG_PATH, "a") as f:
        f.write(json.dumps(record) + "\n")


def _fmt_extra(record: dict) -> str:
    skip = {"run_id", "stage"}
    parts = [f"{k}={v}" for k, v in record.items() if k not in skip and not k.endswith("_ms")]
    return "(" + ", ".join(parts) + ")" if parts else ""
