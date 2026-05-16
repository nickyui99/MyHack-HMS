"""Team Assembly agent tools."""
from __future__ import annotations

from datetime import date
from typing import Any

from a2ui_surfaces import builders
from backend_stub import backend


_ROLES = [
    ("cardiothoracic_surgeon", 2),
    ("cardiac_anaesthetist", 2),
    ("perfusionist", 1),
    ("or_lead_nurse", 1),
]


def _apc_status_text(actor: dict, today: date) -> str:
    try:
        expiry = date.fromisoformat(actor["apc_expiry"])
    except (KeyError, ValueError):
        return "⚠ APC status unknown"
    return "APC valid" if expiry >= today else f"⚠ APC expired {actor['apc_expiry']}"


def find_surgical_team(case_id: str) -> dict[str, Any]:
    """For a CABG case, surface a 4-role team picker grid with ranked candidates per role.

    Args:
        case_id: Case identifier.
    """
    case = backend.get_case(case_id)
    if case is None:
        msg = builders.build_simple_text_surface("team_assembly", "Case not found", f"No case '{case_id}'.")
        return {"caption": "Case not found.", "a2ui_messages": msg["messages"]}

    today = date.today()
    roles_with: dict[str, list[dict[str, Any]]] = {}
    default_picks: dict[str, str] = {}

    for role, _ in _ROLES:
        actors = backend.find_actors_by_role(role)
        scored = []
        for a in actors:
            s = backend.compute_match_score(case, a["actor_id"])
            scored.append({"actor_id": a["actor_id"], "name": a["name"], "score": s["score"],
                           "apc_status_text": _apc_status_text(a, today)})
        scored.sort(key=lambda x: x["score"], reverse=True)
        roles_with[role] = scored[:3]
        if scored:
            default_picks[role] = scored[0]["actor_id"]

    surface = builders.build_team_picker_surface(roles_with, case_id=case_id, default_picks=default_picks)
    return {"caption": f"Top candidates per role for {case['patient_pseudonym']} CABG. Defaults pre-selected.",
            "a2ui_messages": surface["messages"], "default_picks": default_picks}


def lock_team(case_id: str, picks: dict[str, str]) -> dict[str, Any]:
    """Validate picks against compliance, create 4 relationships if clean,
    or emit a compliance block surface if any pick fails.

    Args:
        case_id: Case identifier.
        picks: {role: actor_id} mapping (4 roles).
    """
    case = backend.get_case(case_id)
    if case is None:
        msg = builders.build_simple_text_surface("team_assembly", "Case not found", f"No case '{case_id}'.")
        return {"caption": "Case not found.", "a2ui_messages": msg["messages"]}

    verdict = backend.validate_team(picks, case)
    if not verdict["ok"]:
        # Hand off to compliance surface
        surface = builders.build_compliance_block_surface(verdict["failed"], case_id=case_id)
        return {"caption": f"Compliance blocked {len(verdict['failed'])} pick(s). Please adjust.",
                "a2ui_messages": surface["messages"], "compliance_failed": verdict["failed"]}

    # All clean — create 4 surgical-team relationships pegged to the surgeon (hub-and-spoke).
    surgeon_id = picks.get("cardiothoracic_surgeon")
    created: list[str] = []
    for role, actor_id in picks.items():
        if role == "cardiothoracic_surgeon" or actor_id == surgeon_id:
            continue
        rel = backend.create_relationship("surgical_pair", surgeon_id, actor_id, case)
        created.append(rel["relationship_id"])
    # Also: referral_chain edge surgeon ↔ patient (via case_id) is implicit through team membership.

    team_score = backend.compute_team_score(case, picks)
    summary = (
        f"Team locked. {len(created)} new surgical-pair relationships. "
        f"Team score {team_score['team_score']*100:.0f}% · "
        f"+{int(team_score['pair_bonus']*100)}pp from {team_score['documented_prior_pairs']} prior pairings."
    )
    surface = builders.build_simple_text_surface("team_assembly", "Team locked", summary)
    return {"caption": "Team locked.", "a2ui_messages": surface["messages"],
            "team_score": team_score, "relationships_created": created}
