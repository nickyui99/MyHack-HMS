"""
CareLink Match Service — FastAPI wrapper around retrieval.py.

What this does:
  Exposes three HTTP endpoints that the Node.js backend calls to get
  real AI-powered match results using pgvector + Vertex AI embeddings.

  POST /match/referral       → find best cardiologists for a GP referral
  POST /match/surgical-team  → find best team for a CABG procedure
  POST /match/allied-health  → find best allied health staff post-surgery
  GET  /health               → health check for Cloud Run

How Member 2's backend calls this:
  Replace the hardcoded dummy logic in match.js with:
    const res = await fetch(process.env.MATCH_SERVICE_URL + '/match/referral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    return res.json()

Deployment:
  This runs as a separate Cloud Run service called 'carelink-match-service'.
  Auth: service-to-service via Cloud Run IAM (Member 2 grants run.invoker).
  No API keys. ADC handles Vertex AI and Cloud SQL auth automatically.

Local dev:
  uvicorn main:app --reload --port 8001
"""
from __future__ import annotations

import os

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

import sqlalchemy
from google.cloud.sql.connector import Connector
import pg8000

from retrieval import find_candidates, find_surgical_team, find_allied_health_team, score_team_combination
from outcome_weights import log_outcome


# ── Config ────────────────────────────────────────────────────────────────────

GCP_PROJECT    = os.environ.get("GCP_PROJECT",   "carelink-hackathon")
GCP_REGION     = os.environ.get("GCP_REGION",    "asia-southeast1")
CLOUD_SQL_CONN = os.environ.get("CLOUD_SQL_CONN", f"{GCP_PROJECT}:{GCP_REGION}:carelink-db")
DB_NAME        = os.environ.get("DB_NAME",  "carelink")
DB_USER        = os.environ.get("DB_USER",  "postgres")
DB_PASSWORD    = os.environ.get("DB_PASSWORD", "")


# ── Database (singleton engine, reused across requests) ───────────────────────

_engine: sqlalchemy.engine.Engine | None = None

def get_engine() -> sqlalchemy.engine.Engine:
    global _engine
    if _engine is None:
        connector = Connector()
        def _getconn():
            return connector.connect(
                CLOUD_SQL_CONN, "pg8000",
                user=DB_USER, password=DB_PASSWORD, db=DB_NAME,
            )
        _engine = sqlalchemy.create_engine(
            "postgresql+pg8000://", creator=_getconn, pool_pre_ping=True
        )
    return _engine


# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(title="CareLink Match Service", version="1.0.0")


# ── Request / response models ─────────────────────────────────────────────────

class CaseContext(BaseModel):
    case_id:   str | None = None
    diagnosis: str | None = None
    payer:     str | None = None   # insurance panel, e.g. "Prudential BSN"
    location:  str | None = None
    procedure: str | None = None   # e.g. "CABG"
    urgency:   str | None = None
    clinical_context: dict | None = None

class MatchRequest(BaseModel):
    case_ctx: CaseContext
    top_n:    int = 3              # how many candidates to return per role

class OutcomeRequest(BaseModel):
    case_id:         str
    surgical_score:  int = 5       # 1–5
    complications:   int = 0       # count
    mobility_goals:  str = "met"
    notes:           str = ""
    logged_by:       str = "system"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "carelink-match-service"}


@app.post("/match/referral")
def match_referral(req: MatchRequest):
    """
    Find the best cardiologists for a GP referral.

    Returns top_n cardiologists ranked by vector similarity + compliance + outcome.
    Each candidate includes a score_breakdown so the UI can show WHY they were ranked.
    """
    try:
        candidates = find_candidates(
            engine=get_engine(),
            case_ctx=req.case_ctx.model_dump(exclude_none=True),
            role="cardiologist",
            top_n=req.top_n,
        )
        return {
            "match_type": "referral",
            "candidates": _format_candidates(candidates),
            "top_actor_ids": [str(c["id"]) for c in candidates],
            "score_breakdown": candidates[0]["score_breakdown"] if candidates else {},
            "deterministic_demo": False,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/match/surgical-team")
def match_surgical_team(req: MatchRequest):
    """
    Find the best surgical team for a CABG procedure.

    Returns top candidates per role (anaesthetist, nurse, perfusionist)
    plus a team combination score with historical-pair bonus.
    """
    try:
        case_ctx = req.case_ctx.model_dump(exclude_none=True)
        teams = find_surgical_team(
            engine=get_engine(),
            case_ctx=case_ctx,
            top_n_per_role=req.top_n,
        )

        # Score the top-1 pick per role as the recommended team
        top_picks = {role: candidates[0] for role, candidates in teams.items() if candidates}
        team_score = score_team_combination(top_picks) if top_picks else {}

        return {
            "match_type":   "surgical_team",
            "candidates_by_role": {
                role: _format_candidates(candidates)
                for role, candidates in teams.items()
            },
            "recommended_team": {
                role: _format_candidate(actor)
                for role, actor in top_picks.items()
            },
            "team_score":   team_score,
            "deterministic_demo": False,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/match/allied-health")
def match_allied_health(req: MatchRequest):
    """
    Find the best allied health staff for post-CABG coordination.

    Returns top candidates per role (physiotherapist, dietitian, pharmacist).
    """
    try:
        case_ctx = req.case_ctx.model_dump(exclude_none=True)
        teams = find_allied_health_team(
            engine=get_engine(),
            case_ctx=case_ctx,
            top_n_per_role=req.top_n,
        )

        top_picks = {role: candidates[0] for role, candidates in teams.items() if candidates}

        return {
            "match_type": "allied_health",
            "candidates_by_role": {
                role: _format_candidates(candidates)
                for role, candidates in teams.items()
            },
            "recommended_team": {
                role: _format_candidate(actor)
                for role, actor in top_picks.items()
            },
            "deterministic_demo": False,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/outcomes")
def record_outcome(req: OutcomeRequest):
    """
    Log a case outcome and update every involved actor's outcome_weight.

    Called by Member 4's Outcome Agent after the coordinator types something like:
      "Log outcome for Encik Zainal: surgical 5/5, no complications."

    What happens:
      1. Writes the outcome to every relationship in the case
      2. Nudges each actor's outcome_weight up/down based on the score
      3. Returns a summary so the chatbot can say "weights updated"

    This is what makes the graph weights visibly change during the demo.
    """
    try:
        result = log_outcome(
            engine=get_engine(),
            case_id=req.case_id,
            outcome={
                "surgical_score":  req.surgical_score,
                "complications":   req.complications,
                "mobility_goals":  req.mobility_goals,
                "notes":           req.notes,
            },
            logged_by=req.logged_by,
        )
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Formatting helpers ────────────────────────────────────────────────────────

def _format_candidate(actor: dict) -> dict:
    """Return only the fields the frontend/agent needs — not the raw DB row."""
    bd = actor.get("score_breakdown", {})
    return {
        "id":             str(actor.get("id", "")),
        "name":           actor.get("name", ""),
        "role":           actor.get("role", ""),
        "hospital":       actor.get("hospital", ""),
        "department":     actor.get("department", ""),
        "specialty":      actor.get("specialty", ""),
        "subspecialty":   actor.get("subspecialty", ""),
        "capacity_status":actor.get("capacity_status", ""),
        "capacity_notes": actor.get("capacity_notes", ""),
        "apc_number":     actor.get("apc_number", ""),
        "insurance_panels": actor.get("insurance_panels") or [],
        "languages":      actor.get("languages") or [],
        "score":          bd.get("score", 0.0),
        "score_breakdown": bd,
    }

def _format_candidates(candidates: list[dict]) -> list[dict]:
    return [_format_candidate(c) for c in candidates]
