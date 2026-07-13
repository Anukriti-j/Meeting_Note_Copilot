"""
MCP server (Session 6). Exposes two real, file-writing tools over MCP -- not
hard-coded function calls -- that the agent in src/agent.py consumes via stdio.

Run standalone for debugging:
    python -m src.mcp_server
"""
import uuid
from datetime import datetime, timedelta

from mcp.server.fastmcp import FastMCP

from config import ACTION_ITEMS_DIR, CALENDAR_DIR

mcp = FastMCP("meeting-notes-copilot")


@mcp.tool()
def save_action_items(meeting_id: str, action_items: list[dict]) -> str:
    """Writes a meeting's action items to a markdown file on disk.

    Args:
        meeting_id: identifier of the meeting these action items belong to.
        action_items: list of {"owner": str, "task": str, "due_date": str|None}.
    """
    path = ACTION_ITEMS_DIR / f"{meeting_id}.md"
    lines = [f"# Action items — {meeting_id}", ""]
    for item in action_items:
        due = f" (due {item['due_date']})" if item.get("due_date") else ""
        lines.append(f"- [ ] **{item['owner']}**: {item['task']}{due}")
    path.write_text("\n".join(lines) + "\n")
    return f"wrote {len(action_items)} action item(s) to {path}"


@mcp.tool()
def create_calendar_event(title: str, owner: str, description: str, due_date: str | None = None) -> str:
    """Writes a local .ics calendar file for a follow-up event tied to an action item.

    Args:
        title: short event title.
        owner: person the event is for.
        description: longer description of the task.
        due_date: ISO date (YYYY-MM-DD). Defaults to tomorrow if not provided.
    """
    if due_date:
        dt = datetime.strptime(due_date, "%Y-%m-%d")
    else:
        dt = datetime.now() + timedelta(days=1)
    dtstamp = dt.strftime("%Y%m%dT090000")
    uid = uuid.uuid4().hex
    ics = (
        "BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\n"
        f"UID:{uid}\nDTSTAMP:{dtstamp}\nDTSTART:{dtstamp}\n"
        f"SUMMARY:{title}\nDESCRIPTION:{description} (owner: {owner})\n"
        "END:VEVENT\nEND:VCALENDAR\n"
    )
    path = CALENDAR_DIR / f"{uid}.ics"
    path.write_text(ics)
    return f"created calendar event '{title}' for {owner} at {path}"


if __name__ == "__main__":
    mcp.run()
