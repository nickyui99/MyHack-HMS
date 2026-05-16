"""Referral agent tools."""
from __future__ import annotations

from typing import Any

from a2ui_surfaces import builders
from backend_stub import backend


def find_cardiologist_candidates(case_id: str, top_n: int = 3) -> dict[str, Any]:
    """Find top-N cardiologist candidates for a GP referral case and return a UI surface.

    Args:
        case_id: The case identifier (e.g. 'case_zainal_2026').
        top_n: How many candidates to surface (default 3).

    Returns:
        {caption, a2ui_messages, candidates}
    """
    case = backend.get_case(case_id)
    if case is None:
        msg = builders.build_simple_text_surface("referral", "Case not found", f"No case '{case_id}' in the registry.")
        return {"caption": "Case not found.", "a2ui_messages": msg["messages"], "candidates": []}

    cardios = backend.find_actors_by_role("cardiologist", filters={"panel": case.get("panel")})
    scored = []
    for a in cardios:
        s = backend.compute_match_score(case, a["actor_id"])
        prior = a.get("outcome_history", {}).get("prior_pair_partners", [])
        prior_with_gp = 1 if "act_amirul" in prior else 0  # demo: amirul is the GP persona
        scored.append({**a, **s, "prior_pair_count": prior_with_gp})

    scored.sort(key=lambda x: x["score"], reverse=True)
    top = scored[:top_n]

    surface = builders.build_referral_candidates_surface(
        candidates=[
            {"actor_id": c["actor_id"], "name": c["name"], "hospital_name": c["hospital_name"],
             "breakdown_text": c["breakdown_text"], "score": c["score"], "prior_pair_count": c["prior_pair_count"]}
            for c in top
        ],
        case_id=case_id,
    )
    caption = f"Top {len(top)} cardiologist candidates for {case['patient_pseudonym']}."
    return {"caption": caption, "a2ui_messages": surface["messages"],
            "candidates": [{"actor_id": c["actor_id"], "name": c["name"], "score": c["score"]} for c in top]}


def confirm_referral(case_id: str, cardio_actor_id: str, gp_actor_id: str = "act_amirul") -> dict[str, Any]:
    """Persist GP→cardiologist referral relationship and return a confirmation surface.

    Args:
        case_id: Case identifier.
        cardio_actor_id: Selected cardiologist actor_id.
        gp_actor_id: GP actor_id (defaults to act_amirul for the demo).
    """
    case = backend.get_case(case_id)
    if case is None:
        msg = builders.build_simple_text_surface("referral", "Case not found", f"No case '{case_id}'.")
        return {"caption": "Case not found.", "a2ui_messages": msg["messages"]}

    rel = backend.create_relationship("referral_chain", gp_actor_id, cardio_actor_id, case)
    cardio = backend.get_actor(cardio_actor_id)
    name = cardio["name"] if cardio else cardio_actor_id
    surface = builders.build_simple_text_surface(
        "referral",
        "Referral committed",
        f"Case {case_id} opened. Referral to {name} created (relationship {rel['relationship_id']}, match {rel['match_score']*100:.0f}%).",
    )
    return {"caption": f"Referral to {name} confirmed.", "a2ui_messages": surface["messages"],
            "relationship_id": rel["relationship_id"]}
