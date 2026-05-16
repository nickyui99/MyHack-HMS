"""Allied Health agent tools."""
from __future__ import annotations

from typing import Any

from a2ui_surfaces import builders
from backend_stub import backend


_ALLIED_ROLES = ["physiotherapist", "dietician", "occupational_therapist"]


def find_allied_specialists(case_id: str) -> dict[str, Any]:
    """For a post-CABG ward patient, surface 1 candidate each for physio, dietician, OT.

    Args:
        case_id: Case identifier.
    """
    case = backend.get_case(case_id)
    if case is None:
        msg = builders.build_simple_text_surface("allied_health", "Case not found", f"No case '{case_id}'.")
        return {"caption": "Case not found.", "a2ui_messages": msg["messages"]}

    specialists: list[dict[str, Any]] = []
    for role in _ALLIED_ROLES:
        candidates = backend.find_actors_by_role(role)
        scored = []
        for a in candidates:
            s = backend.compute_match_score(case, a["actor_id"])
            scored.append({"role": role, "actor_id": a["actor_id"], "name": a["name"],
                           "breakdown_text": s["breakdown_text"], "score": s["score"]})
        scored.sort(key=lambda x: x["score"], reverse=True)
        if scored:
            specialists.append(scored[0])

    surface = builders.build_allied_cards_surface(specialists, case_id=case_id)
    return {"caption": f"Recommended allied health team for {case['patient_pseudonym']}.",
            "a2ui_messages": surface["messages"], "specialists": specialists}


def book_specialist(case_id: str, role: str, actor_id: str, ward_actor: str = "act_priya") -> dict[str, Any]:
    """Book a single allied health specialist for the case.

    Args:
        case_id: Case identifier.
        role: Allied role (physiotherapist, dietician, occupational_therapist).
        actor_id: Selected actor.
        ward_actor: Not used in stub; placeholder for ward nurse handoff actor.
    """
    case = backend.get_case(case_id)
    if case is None:
        msg = builders.build_simple_text_surface("allied_health", "Case not found", f"No case '{case_id}'.")
        return {"caption": "Case not found.", "a2ui_messages": msg["messages"]}

    rel = backend.create_relationship("allied_health", "act_amirul", actor_id, case)  # surgeon ref point
    actor = backend.get_actor(actor_id)
    name = actor["name"] if actor else actor_id
    surface = builders.build_simple_text_surface(
        "allied_health",
        f"{role.replace('_',' ').title()} booked",
        f"{name} booked for {case['patient_pseudonym']} (relationship {rel['relationship_id']}).",
    )
    return {"caption": f"{role.replace('_',' ').title()} booked: {name}.",
            "a2ui_messages": surface["messages"], "relationship_id": rel["relationship_id"]}
