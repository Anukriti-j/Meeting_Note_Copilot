"""
Transcript -> structured JSON summary (Session 2: structured output + few-shot).

Uses function-calling (OpenAI-compatible, served by Google AI Studio's Gemini endpoint) with tool_choice
forced to a single "record_summary" function so the model can't wander off schema --
this is the modern equivalent of "JSON mode" with a guaranteed shape.
"""
import json

from config import GOOGLE_MODEL, SUMMARY_TEMPERATURE
from src.llm_client import get_client
from src.logging_utils import stage_timer, log_tokens

SUMMARY_TOOL = {
    "type": "function",
    "function": {
        "name": "record_summary",
        "description": "Records a structured summary of a meeting transcript.",
        "parameters": {
            "type": "object",
            "properties": {
                "summary": {
                    "type": "string",
                    "description": "2-4 sentence summary of what the meeting covered and decided.",
                },
                "decisions": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Concrete decisions made, phrased as standalone facts (e.g. 'Billing migration will move to Stripe in Q3').",
                },
                "action_items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "owner": {"type": "string", "description": "Person responsible. Use 'unassigned' if not stated."},
                            "task": {"type": "string"},
                            "due_date": {"type": ["string", "null"], "description": "ISO date if mentioned, else null."},
                        },
                        "required": ["owner", "task", "due_date"],
                    },
                },
            },
            "required": ["summary", "decisions", "action_items"],
        },
    },
}

# One worked example biases the model toward the right granularity and tone
# (Session 2: few-shot earns its place here because "summarize" is otherwise ambiguous
# about how terse or how exhaustive the action items should be).
FEW_SHOT_TRANSCRIPT = (
    "Priya: Let's do a quick standup. I finished the login screen yesterday. "
    "Tom: I'm blocked on the payments API, still waiting on credentials from DevOps. "
    "Priya: Okay, I'll ping DevOps today and get you those credentials. "
    "Tom: Thanks. Also, someone should update the sprint board, it's out of date. "
    "Priya: I'll do that by Friday."
)
FEW_SHOT_SUMMARY = {
    "summary": "Quick standup: Priya finished the login screen; Tom is blocked on the payments API waiting on DevOps credentials.",
    "decisions": ["Priya will unblock Tom by requesting payments API credentials from DevOps."],
    "action_items": [
        {"owner": "Priya", "task": "Ping DevOps for payments API credentials", "due_date": None},
        {"owner": "Priya", "task": "Update the sprint board", "due_date": "2026-07-03"},
    ],
}
FEW_SHOT_TOOL_CALL_ID = "call_few_shot_example"

SYSTEM_PROMPT = """You summarize meeting transcripts precisely and conservatively.
Only record decisions and action items that are actually stated or clearly implied in the transcript.
Never invent an owner or due date -- if unstated, use "unassigned" for owner and null for due_date.
You will be told the meeting's date. When the transcript gives a due date without a year
(e.g. "by Monday", "by the 12th", "next Tuesday"), resolve it to an absolute ISO date using
the meeting's date as the reference point -- never default to a year unrelated to the meeting."""


def summarize(transcript: str, run_id: str, meeting_id: str, meeting_date: str) -> dict:
    with stage_timer(run_id, "llm", meeting_id=meeting_id, purpose="summarize") as _record:
        response = get_client().chat.completions.create(
            model=GOOGLE_MODEL,
            max_tokens=1024,
            temperature=SUMMARY_TEMPERATURE,
            tools=[SUMMARY_TOOL],
            tool_choice={"type": "function", "function": {"name": "record_summary"}},
            # No deep reasoning needed for structured extraction, and it avoids Gemini's
            # internal "thinking" tokens quietly eating into max_tokens (see rag_qa.py).
            extra_body={"reasoning_effort": "none"},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Meeting date: 2026-07-01\nTranscript:\n{FEW_SHOT_TRANSCRIPT}"},
                {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [
                        {
                            "id": FEW_SHOT_TOOL_CALL_ID,
                            "type": "function",
                            "function": {
                                "name": "record_summary",
                                "arguments": json.dumps(FEW_SHOT_SUMMARY),
                            },
                        }
                    ],
                },
                {"role": "tool", "tool_call_id": FEW_SHOT_TOOL_CALL_ID, "content": "recorded"},
                {
                    "role": "user",
                    "content": f"Now do the same for this transcript.\nMeeting date: {meeting_date}\nTranscript:\n{transcript}",
                },
            ],
        )
    log_tokens(run_id, "summarize", response.usage.prompt_tokens, response.usage.completion_tokens)

    tool_call = response.choices[0].message.tool_calls[0]
    result = json.loads(tool_call.function.arguments)
    result["meeting_id"] = meeting_id
    result["transcript"] = transcript
    return result


if __name__ == "__main__":
    demo = summarize(
        "Standup: Alice says the billing migration to Stripe is done in staging. "
        "Bob will run the production cutover next Tuesday. Carol flags that support "
        "macros still reference the old billing provider and someone needs to update them.",
        run_id="demo",
        meeting_id="demo-meeting",
        meeting_date="2026-07-12",
    )
    print(json.dumps(demo, indent=2))
