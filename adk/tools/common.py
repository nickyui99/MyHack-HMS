"""Shared helpers for agent tools."""
from __future__ import annotations

import json
import pathlib
from functools import lru_cache
from typing import Any


_PERSONAS_PATH = pathlib.Path(__file__).parent.parent / "personas" / "personas.json"


@lru_cache(maxsize=1)
def _personas() -> dict[str, dict[str, Any]]:
    raw = json.loads(_PERSONAS_PATH.read_text(encoding="utf-8"))
    return {p["user_id"]: p for p in raw}


def get_persona(user_id: str) -> dict[str, Any] | None:
    """Resolve a persona by user_id. Used as a tool by the orchestrator."""
    return _personas().get(user_id)


def all_personas() -> list[dict[str, Any]]:
    return list(_personas().values())


# Prompt fragment every specialist agent appends to its system instruction so
# the LLM consistently wraps tool output as A2UI surface messages.
A2UI_OUTPUT_RULES = """
## Output rules — read carefully

After your tool returns, the response object has TWO top-level keys you must use:
  result["caption"]         — a one-line natural-language summary string
  result["a2ui_messages"]   — a JSON list of A2UI v0.9 protocol messages

Your reply MUST contain exactly these two parts in this order:

  1. The literal string of result["caption"], followed by a newline.
  2. The marker `<a2ui-json>` on its own line, then the EXACT JSON serialization
     of `result["a2ui_messages"]` (the list), then the marker `</a2ui-json>` on
     its own line.

CRITICAL: Inside the `<a2ui-json>` tags, output ONLY the value of
`result["a2ui_messages"]` — do NOT wrap it in `{"tool_name": ...}`, do NOT
add `tool_result` or `role` envelopes, do NOT rename keys, do NOT invent
actor_ids, names, or scores. Copy the list character-for-character.

Do NOT write anything after the closing `</a2ui-json>` tag.
"""
