"""
Runs eval/eval_set.json against the live RAG pipeline and scores it.

This is a cheap keyword-overlap check, not a semantic judge -- good enough to catch
"retrieval found the wrong meeting" or "model refused when it shouldn't have," which
is what the assignment eval is actually meant to surface.

Usage: python -m eval.run_eval
Requires: `python cli.py seed` has already been run so the store has data.
"""
import json
from pathlib import Path

from src.logging_utils import new_run_id
from src.rag_qa import ask

EVAL_PATH = Path(__file__).parent / "eval_set.json"


def run():
    cases = json.loads(EVAL_PATH.read_text())
    passed = 0
    for case in cases:
        result = ask(case["question"], run_id=new_run_id())
        answer_lower = result["answer"].lower()

        keyword_hit = all(kw.lower() in answer_lower for kw in case["expected_keywords"])
        meeting_hit = case["expected_meeting"] is None or case["expected_meeting"] in result["citations"]
        ok = keyword_hit and meeting_hit

        passed += ok
        status = "PASS" if ok else "FAIL"
        print(f"[{status}] {case['id']}: {case['question']}")
        print(f"        answer: {result['answer']}")
        print(f"        citations: {result['citations']}\n")

    print(f"Score: {passed}/{len(cases)}")


if __name__ == "__main__":
    run()
