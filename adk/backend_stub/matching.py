"""Deterministic scoring — placeholder until Member 3 ships text-embedding-005 + pgvector.

Vector similarity is a token-jaccard proxy on `embedding_text`. Rule and outcome
components are explicit. Swap `_token_similarity` only — function signatures stay.
"""
from __future__ import annotations

import re


_WORD_RE = re.compile(r"[a-z0-9]+")


def _tokens(text: str) -> set[str]:
    return set(_WORD_RE.findall((text or "").lower()))


def _token_similarity(a_text: str, b_text: str) -> float:
    """Jaccard over token sets. Swap for cosine on text-embedding-005 vectors later."""
    ta, tb = _tokens(a_text), _tokens(b_text)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def compute_match_score(case_ctx: dict, actor: dict) -> dict:
    vector = _token_similarity(case_ctx.get("embedding_text", ""), actor.get("embedding_text", ""))
    # Vector is naturally small with jaccard — rescale so demo numbers look credible.
    vector = min(1.0, vector * 3.5)

    rule = 1.0
    panel = case_ctx.get("panel")
    if panel and actor.get("insurance_panels"):
        rule = 1.0 if panel in actor["insurance_panels"] else 0.4

    outcome_h = actor.get("outcome_history", {})
    sat = outcome_h.get("patient_satisfaction", 4.0)
    comp = outcome_h.get("complication_rate", 0.05)
    outcome = max(0.0, min(1.0, (sat / 5.0) - comp * 2.0))

    score = 0.55 * vector + 0.25 * rule + 0.20 * outcome
    return {
        "score": round(score, 3),
        "vector": round(vector, 3),
        "rule": round(rule, 3),
        "outcome": round(outcome, 3),
        "breakdown_text": f"vector {vector:.2f} · rule {rule:.2f} · outcome {outcome:.2f}",
    }


def compute_team_score(case_ctx: dict, picks_with_actors: dict[str, dict], pair_bonus_pct: float = 0.10) -> dict:
    """Returns aggregate score with historical-pair bonus.

    picks_with_actors = {role: actor_dict}.
    Pair bonus = +10% per documented prior partnership among the picks.
    """
    per_role = {}
    for role, actor in picks_with_actors.items():
        per_role[role] = compute_match_score(case_ctx, actor)
    base = sum(s["score"] for s in per_role.values()) / max(1, len(per_role))

    actor_ids = [a["actor_id"] for a in picks_with_actors.values()]
    pair_hits = 0
    for a in picks_with_actors.values():
        for partner in a.get("outcome_history", {}).get("prior_pair_partners", []):
            if partner in actor_ids:
                pair_hits += 1
    pair_hits //= 2  # each pair counted twice
    pair_bonus = pair_bonus_pct * pair_hits

    team_score = round(min(1.0, base + pair_bonus), 3)
    return {
        "team_score": team_score,
        "per_role_scores": per_role,
        "pair_bonus": round(pair_bonus, 3),
        "documented_prior_pairs": pair_hits,
    }
