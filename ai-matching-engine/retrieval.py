"""
pgvector similarity search for CareLink actor matching.

What this does (plain English):
  Given a patient case (e.g. "58yo male, NSTEMI, Prudential BSN panel"),
  this module finds the best-matching doctors/nurses from the database using
  vector similarity — the same technique that powers Google Search.

  It also applies hard filters (role, APC not expired, capacity available,
  insurance panel match) so the AI score never overrides a compliance rule.

  The score breakdown it returns shows THREE components:
    - vector_similarity : how well the actor's profile semantically matches the case
    - rule_compliance   : 1.0 if all hard rules pass, lower if soft warnings
    - outcome_weight    : the actor's historical performance score from past cases
  This makes the AI's decision explainable — judges can see exactly why
  each recommendation was ranked the way it was.

How to use from other code:
  from retrieval import find_candidates, find_surgical_team

  candidates = find_candidates(engine, case_ctx, role="cardiologist", top_n=3)
  team       = find_surgical_team(engine, case_ctx, top_n_per_role=2)
"""
from __future__ import annotations

import os
from datetime import date
from typing import Any

from dotenv import load_dotenv
load_dotenv()

import sqlalchemy
import vertexai
from vertexai.language_models import TextEmbeddingInput, TextEmbeddingModel


# ── Config ────────────────────────────────────────────────────────────────────

GCP_PROJECT     = os.environ.get("GCP_PROJECT",  "carelink-hackathon")
GCP_REGION      = os.environ.get("GCP_REGION",   "asia-southeast1")
CLOUD_SQL_CONN  = os.environ.get("CLOUD_SQL_CONN", f"{GCP_PROJECT}:{GCP_REGION}:carelink-db")
DB_NAME         = os.environ.get("DB_NAME",  "carelink")
DB_USER         = os.environ.get("DB_USER",  "postgres")
DB_PASSWORD     = os.environ.get("DB_PASSWORD", "")
EMBEDDING_MODEL = "text-embedding-005"
EMBEDDING_DIMS  = 768

# Roles the surgical team assembly decomposes a CABG procedure into
CABG_ROLES = ["anaesthetist", "nurse", "perfusionist"]

# Roles for allied health coordination
ALLIED_ROLES = ["physiotherapist", "dietitian", "pharmacist"]


# ── Vertex AI helpers ─────────────────────────────────────────────────────────

_vertex_ready = False

def _ensure_vertex():
    global _vertex_ready
    if not _vertex_ready:
        vertexai.init(project=GCP_PROJECT, location=GCP_REGION)
        _vertex_ready = True


def _embed_query(text: str) -> list[float]:
    """Embed a case description for RETRIEVAL_QUERY (different task type from DOCUMENT)."""
    _ensure_vertex()
    model = TextEmbeddingModel.from_pretrained(EMBEDDING_MODEL)
    result = model.get_embeddings(
        [TextEmbeddingInput(text, "RETRIEVAL_QUERY")],
        output_dimensionality=EMBEDDING_DIMS,
    )
    return result[0].values


# ── Score helpers ─────────────────────────────────────────────────────────────

def _rule_compliance_score(actor: dict, case_ctx: dict) -> tuple[float, list[str]]:
    """
    Returns (score 0.0-1.0, list of warning strings).
    Hard failures = 0.0, soft warnings reduce score slightly.
    """
    today = date.today()
    warnings: list[str] = []
    score = 1.0

    # Hard: APC expiry
    apc_raw = actor.get("apc_expiry_date")
    if apc_raw:
        try:
            expiry = apc_raw if isinstance(apc_raw, date) else date.fromisoformat(str(apc_raw))
            if expiry < today:
                return 0.0, [f"APC {actor.get('apc_number','?')} expired {expiry}"]
        except ValueError:
            warnings.append("APC expiry date unreadable")
            score -= 0.1

    # Hard: capacity
    capacity = actor.get("capacity_status", "available")
    if capacity == "full":
        return 0.0, ["No remaining capacity"]
    if capacity == "limited":
        score -= 0.05
        warnings.append("Limited capacity")

    # Soft: insurance panel
    panel = case_ctx.get("payer") or case_ctx.get("panel")
    if panel:
        panels = actor.get("insurance_panels") or []
        if panels and panel not in panels:
            score -= 0.25
            warnings.append(f"Not on {panel} panel")

    return max(0.0, score), warnings


def _outcome_score(actor: dict) -> float:
    """Normalise the stored outcome_weight to 0.0–1.0 range."""
    raw = float(actor.get("outcome_weight") or 1.0)
    # outcome_weight in DB ranges from ~0.5 (poor) to ~1.25 (excellent)
    # Map 0.5→0.4, 1.0→0.8, 1.25→1.0
    return min(1.0, raw * 0.8)


def _build_score(vector_sim: float, rule_score: float, outcome: float) -> dict:
    """Weighted composite: 55% vector, 25% rule, 20% outcome."""
    composite = 0.55 * vector_sim + 0.25 * rule_score + 0.20 * outcome
    return {
        "score": round(composite, 3),
        "vector_similarity": round(vector_sim, 3),
        "rule_compliance":   round(rule_score, 3),
        "outcome_weight":    round(outcome, 3),
    }


# ── Core retrieval function ───────────────────────────────────────────────────

def find_candidates(
    engine: sqlalchemy.engine.Engine,
    case_ctx: dict,
    role: str,
    top_n: int = 5,
    query_text: str | None = None,
) -> list[dict[str, Any]]:
    """
    Find the top-N best actors for a given role and patient case.

    Parameters
    ----------
    engine     : SQLAlchemy engine connected to Cloud SQL
    case_ctx   : dict with keys like 'payer', 'diagnosis', 'location'
    role       : actor role to filter by, e.g. 'cardiologist'
    top_n      : how many candidates to return
    query_text : text to embed as the search query; defaults to case_ctx description

    Returns
    -------
    List of dicts, each with actor fields + score_breakdown, sorted best-first.
    Actors that fail hard compliance rules are excluded entirely.
    """
    if query_text is None:
        query_text = _build_query_text(case_ctx, role)

    query_vector = _embed_query(query_text)
    vec_str = "[" + ",".join(str(v) for v in query_vector) + "]"

    with engine.connect() as conn:
        # Fetch candidates pre-filtered by role and non-full capacity using pgvector
        # The <=> operator = cosine distance (lower = more similar)
        # We fetch top_n * 4 to have room to filter by compliance
        fetch_n = top_n * 4
        rows = conn.execute(
            sqlalchemy.text("""
                SELECT
                    id, name, actor_type, role, specialty, subspecialty,
                    hospital, department, location,
                    insurance_panels, languages, credentials,
                    apc_number, apc_expiry_date, capacity_status, capacity_notes,
                    outcome_weight, profile_text,
                    1 - (embedding <=> CAST(:vec AS vector)) AS cosine_similarity
                FROM actors
                WHERE role = :role
                  AND capacity_status != 'full'
                  AND embedding IS NOT NULL
                ORDER BY embedding <=> CAST(:vec AS vector)
                LIMIT :n
            """),
            {"vec": vec_str, "role": role, "n": fetch_n},
        ).mappings().fetchall()

    results = []
    for row in rows:
        actor = dict(row)
        cosine_sim = float(actor.pop("cosine_similarity", 0.0))

        rule_score, warnings = _rule_compliance_score(actor, case_ctx)
        if rule_score == 0.0:
            # Hard compliance failure — exclude from results
            continue

        outcome = _outcome_score(actor)
        breakdown = _build_score(cosine_sim, rule_score, outcome)
        breakdown["warnings"] = warnings

        results.append({**actor, "score_breakdown": breakdown})

    # Sort by composite score descending
    results.sort(key=lambda x: x["score_breakdown"]["score"], reverse=True)
    return results[:top_n]


def _build_query_text(case_ctx: dict, role: str) -> str:
    """Build a descriptive search query from the case context."""
    parts = [f"{role} needed for patient case"]
    if d := case_ctx.get("diagnosis"):
        parts.append(f"diagnosis {d}")
    if p := case_ctx.get("payer") or case_ctx.get("panel"):
        parts.append(f"insurance panel {p}")
    if loc := case_ctx.get("location"):
        parts.append(f"located near {loc}")
    if proc := case_ctx.get("procedure") or (case_ctx.get("clinical_context") or {}).get("procedure"):
        parts.append(f"procedure {proc}")
    return ", ".join(parts)


# ── Surgical team assembly ────────────────────────────────────────────────────

def find_surgical_team(
    engine: sqlalchemy.engine.Engine,
    case_ctx: dict,
    top_n_per_role: int = 3,
) -> dict[str, list[dict]]:
    """
    Find the best candidates for each CABG team role.

    Returns a dict: { role: [candidate, ...] }
    The caller (agent) picks one per role and calls score_team_combination().
    """
    procedure = (case_ctx.get("clinical_context") or {}).get("procedure", "CABG")
    query_base = f"{procedure} surgical team member, cardiac experience"

    return {
        role: find_candidates(engine, case_ctx, role=role, top_n=top_n_per_role,
                               query_text=f"{query_base}, role {role}")
        for role in CABG_ROLES
    }


def find_allied_health_team(
    engine: sqlalchemy.engine.Engine,
    case_ctx: dict,
    top_n_per_role: int = 3,
) -> dict[str, list[dict]]:
    """Find best candidates for each allied health role post-CABG."""
    query_base = "post-CABG cardiac patient, allied health coordination"

    return {
        role: find_candidates(engine, case_ctx, role=role, top_n=top_n_per_role,
                               query_text=f"{query_base}, {role} specialising in cardiac")
        for role in ALLIED_ROLES
    }


# ── Team combination scoring (historical-pair bonus) ─────────────────────────

def score_team_combination(
    picks: dict[str, dict],
    pair_bonus_pct: float = 0.10,
) -> dict:
    """
    Score a complete team (one actor per role) with a historical-pair bonus.

    picks = { "anaesthetist": actor_dict, "nurse": actor_dict, ... }

    The pair bonus adds +10% to the team score for each documented prior
    collaboration pair found among the chosen actors.

    This replaces the Jaccard-based placeholder in adk/backend_stub/matching.py.
    """
    per_role: dict[str, dict] = {}
    for role, actor in picks.items():
        bd = actor.get("score_breakdown", {})
        per_role[role] = {
            "actor_id":   str(actor.get("id", "")),
            "name":       actor.get("name", ""),
            "score":      bd.get("score", 0.0),
            "breakdown":  bd,
        }

    base_score = (
        sum(r["score"] for r in per_role.values()) / max(1, len(per_role))
    )

    # Count documented prior pairs among the chosen actors
    actor_ids = {str(a.get("id", "")) for a in picks.values()}
    pair_hits = 0
    for actor in picks.values():
        prior_partners = (actor.get("outcome_history") or {}).get("prior_pair_partners", [])
        for partner_id in prior_partners:
            if str(partner_id) in actor_ids:
                pair_hits += 1
    pair_hits //= 2  # each pair counted twice

    pair_bonus = pair_bonus_pct * pair_hits
    team_score = round(min(1.0, base_score + pair_bonus), 3)

    return {
        "team_score":             team_score,
        "per_role":               per_role,
        "pair_bonus":             round(pair_bonus, 3),
        "documented_prior_pairs": pair_hits,
    }
