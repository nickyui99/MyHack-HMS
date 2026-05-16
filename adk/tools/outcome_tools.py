"""Outcome agent tools."""
from __future__ import annotations

from typing import Any

from a2ui_surfaces import builders
from backend_stub import backend


def open_outcome_form(case_id: str) -> dict[str, Any]:
    """Surface the outcome capture form for the given case.

    Args:
        case_id: Case identifier.
    """
    surface = builders.build_outcome_form_surface(case_id=case_id)
    return {"caption": "Log the post-op outcome.", "a2ui_messages": surface["messages"]}


def record_case_outcome(case_id: str, surgical_score: int, complications: str = "0", notes: str = "") -> dict[str, Any]:
    """Persist the outcome, update relationship weights, and emit the graph-delta surface.

    Args:
        case_id: Case identifier.
        surgical_score: Integer 1-5.
        complications: One of "0" (none), "minor", "major".
        notes: Free text.
    """
    case = backend.get_case(case_id)
    if case is None:
        msg = builders.build_simple_text_surface("outcome", "Case not found", f"No case '{case_id}'.")
        return {"caption": "Case not found.", "a2ui_messages": msg["messages"]}

    backend.record_outcome(case_id, {
        "surgical_score": int(surgical_score),
        "complications": 0 if complications in ("0", 0, "none", "None") else complications,
        "mobility_goal_met": True,
    }, notes=notes)
    weights = backend.update_relationship_weights(case_id)
    delta = backend.get_graph_delta(case_id)
    delta["weight_changes"] = weights["weight_changes"]

    surface = builders.build_outcome_delta_surface(delta)
    return {"caption": f"Outcome recorded for {case['patient_pseudonym']}. {len(weights['weight_changes'])} relationships updated.",
            "a2ui_messages": surface["messages"], "weight_changes": weights["weight_changes"]}
