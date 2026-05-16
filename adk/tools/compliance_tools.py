"""Compliance agent tools — deterministic guards."""
from __future__ import annotations

from typing import Any

from a2ui_surfaces import builders
from backend_stub import backend


def validate_actor(actor_id: str, case_id: str) -> dict[str, Any]:
    """Check a single actor against deterministic compliance rules (APC, capacity, subspecialty, panel).

    Args:
        actor_id: Actor under review.
        case_id: Case context (used for panel + subspecialty checks).
    """
    case = backend.get_case(case_id)
    verdict = backend.check_compliance(actor_id, case)
    if verdict["ok"]:
        actor_name = (verdict.get("actor") or {}).get("name", actor_id)
        surface = builders.build_simple_text_surface("compliance", "Compliance: PASS",
                                                    f"{actor_name} passes all compliance checks.")
        return {"caption": f"{actor_name} clears compliance.", "a2ui_messages": surface["messages"], "ok": True}
    # Single-actor block — wrap as compliance block surface
    failed = [{"role": (verdict.get("actor") or {}).get("role", "actor"),
               "actor_id": actor_id, "actor": verdict.get("actor"), "reasons": verdict["reasons"]}]
    surface = builders.build_compliance_block_surface(failed, case_id=case_id)
    actor_name = (verdict.get("actor") or {}).get("name", actor_id)
    return {"caption": f"{actor_name} blocked: {'; '.join(verdict['reasons'])}.",
            "a2ui_messages": surface["messages"], "ok": False, "reasons": verdict["reasons"]}


def validate_team_picks(case_id: str, picks: dict[str, str]) -> dict[str, Any]:
    """Validate every pick in a proposed team and emit a compliance block surface for failures.

    Args:
        case_id: Case identifier.
        picks: {role: actor_id} mapping.
    """
    case = backend.get_case(case_id)
    verdict = backend.validate_team(picks, case)
    if verdict["ok"]:
        surface = builders.build_simple_text_surface("compliance", "Team compliance: PASS",
                                                    "All 4 picks clear compliance — safe to lock.")
        return {"caption": "All picks clear.", "a2ui_messages": surface["messages"], "ok": True}
    surface = builders.build_compliance_block_surface(verdict["failed"], case_id=case_id)
    return {"caption": f"{len(verdict['failed'])} pick(s) blocked.", "a2ui_messages": surface["messages"],
            "ok": False, "failed": verdict["failed"]}
