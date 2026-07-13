"""
Tool-calling agent (Session 4 + Session 5 + Session 6).

Architecture pattern: ReAct-style Thought -> Action -> Observation loop, capped by
MAX_ITERATIONS. Tools are not hard-coded Python functions -- they are proxied over
MCP to src/mcp_server.py, and every tool call is confirmed (human-in-the-loop) before
it runs, since these actions write files to disk.
"""
import json

from config import GOOGLE_MODEL, AGENT_TEMPERATURE, MAX_ITERATIONS
from src.llm_client import get_client
from src.logging_utils import stage_timer, log_tokens, log_tool_call
from src.mcp_client import mcp_session, list_tools_as_openai_schema, call_tool

SYSTEM_PROMPT = """You are an action-taking assistant for a meeting-notes system.
You will be given a meeting's action items. Decide which tool calls are needed to file
them (e.g. saving an action-items file, and creating calendar events for items that have
a due date). Do the minimum necessary tool calls, then stop and summarize what you did in
plain text. Do not call a tool with invented data -- only use what's in the meeting context."""


async def run_agent(meeting_summary: dict, run_id: str, auto_approve: bool = False) -> str:
    """
    Runs a bounded tool-calling loop against the MCP-exposed tools.
    Returns the agent's final plain-text summary of what it did (or didn't do).
    """
    async with mcp_session() as session:
        tools = await list_tools_as_openai_schema(session)

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Meeting: {meeting_summary['meeting_id']}\n"
                    f"Action items: {meeting_summary.get('action_items', [])}\n"
                    "File these appropriately using the available tools."
                ),
            },
        ]

        for iteration in range(1, MAX_ITERATIONS + 1):
            with stage_timer(run_id, "llm", purpose="agent", iteration=iteration) as _record:
                response = get_client().chat.completions.create(
                    model=GOOGLE_MODEL,
                    max_tokens=1024,
                    temperature=AGENT_TEMPERATURE,
                    tools=tools,
                    messages=messages,
                    # Tool selection here is a direct decision, not a puzzle needing deep
                    # reasoning -- avoids Gemini's internal "thinking" tokens eating into
                    # max_tokens (see rag_qa.py for where this silently truncated an answer).
                    extra_body={"reasoning_effort": "none"},
                )
            log_tokens(run_id, f"agent_iter{iteration}", response.usage.prompt_tokens, response.usage.completion_tokens)

            message = response.choices[0].message
            thought = (message.content or "").strip()
            if thought:
                print(f"[{run_id}] Thought (iter {iteration}): {thought}")

            messages.append(message.model_dump(exclude_none=True))

            if not message.tool_calls:
                return thought or "(agent finished with no tool calls)"

            for tool_call in message.tool_calls:
                name = tool_call.function.name
                args = json.loads(tool_call.function.arguments)

                if not auto_approve:
                    approved = _confirm(name, args)
                    if not approved:
                        observation = "user declined this action"
                        log_tool_call(run_id, name, args, observation, iteration)
                        messages.append(_tool_result(tool_call.id, observation))
                        continue
                try:
                    observation = await call_tool(session, name, args)
                except Exception as exc:  # noqa: BLE001 -- surfaced back to the model as an Observation
                    observation = f"error: {exc}"
                log_tool_call(run_id, name, args, observation, iteration)
                messages.append(_tool_result(tool_call.id, observation))

        print(f"[{run_id}] MAX_ITERATIONS ({MAX_ITERATIONS}) reached without a final answer.")
        return f"(stopped after {MAX_ITERATIONS} iterations without finishing)"


def _tool_result(tool_call_id: str, content: str) -> dict:
    return {"role": "tool", "tool_call_id": tool_call_id, "content": content}


def _confirm(tool_name: str, tool_input: dict) -> bool:
    reply = input(f"  Agent wants to call '{tool_name}' with {tool_input}. Proceed? [y/N] ").strip().lower()
    return reply == "y"
