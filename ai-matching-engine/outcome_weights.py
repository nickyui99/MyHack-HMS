"""
Outcome feedback loop — writes case outcomes to relationships and updates actor weights.

What this does (plain English):
  After a patient's case finishes (e.g. Encik Zainal's CABG is done),
  the team submits an outcome score: "surgical 5/5, no complications."

  This module does two things with that information:
    1. Writes the outcome to every relationship involved in the case
       (so the relationship graph records what happened).
    2. Updates each involved actor's outcome_weight in the database
       (so the next patient gets better recommendations based on past performance).

  Example: if Dr Farah Nabila handled the CABG referral with 5/5 outcome,
  her outcome_weight goes up slightly — meaning she'll rank higher in future
  NSTEMI referral matches. This is how "the ecosystem learns."

How to use from other code:
  from outcome_weights import log_outcome

  log_outcome(engine, case_id="10000000-...", outcome={
      "surgical_score": 5,
      "complications": 0,
      "mobility_goals": "met",
      "notes": "No post-op complications. Discharge day 6."
  }, logged_by="ward@carelink.test")

How to run as a script (demo):
  python outcome_weights.py --case-id 10000000-0000-4000-8000-000000000001
"""
from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone

from dotenv import load_dotenv
load_dotenv()

import sqlalchemy


# ── Config ────────────────────────────────────────────────────────────────────

GCP_PROJECT    = os.environ.get("GCP_PROJECT",  "carelink-hackathon")
GCP_REGION     = os.environ.get("GCP_REGION",   "asia-southeast1")
CLOUD_SQL_CONN = os.environ.get(
    "CLOUD_SQL_CONN",
    f"{GCP_PROJECT}:{GCP_REGION}:carelink-db"
)
DB_NAME     = os.environ.get("DB_NAME", "carelink")
DB_USER     = os.environ.get("DB_USER", "postgres")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "")

# How much to adjust outcome_weight per case (small nudge, not a hard reset)
WEIGHT_NUDGE_GOOD = 0.02   # +2% for a good outcome (score >= 4)
WEIGHT_NUDGE_BAD  = 0.05   # -5% for a bad outcome  (score <= 2)
WEIGHT_MAX        = 1.50   # cap — no actor climbs above this
WEIGHT_MIN        = 0.20   # floor — no actor drops below this


# ── Database connection ───────────────────────────────────────────────────────

def _build_engine() -> sqlalchemy.engine.Engine:
    from google.cloud.sql.connector import Connector
    import pg8000

    connector = Connector()

    def _getconn():
        return connector.connect(
            CLOUD_SQL_CONN,
            "pg8000",
            user=DB_USER,
            password=DB_PASSWORD,
            db=DB_NAME,
        )

    return sqlalchemy.create_engine(
        "postgresql+pg8000://", creator=_getconn, pool_pre_ping=True
    )


# ── Core outcome logic ────────────────────────────────────────────────────────

def log_outcome(
    engine: sqlalchemy.engine.Engine,
    case_id: str,
    outcome: dict,
    logged_by: str = "system",
) -> dict:
    """
    Write a case outcome to all active/completed relationships for this case,
    then nudge the outcome_weight for every involved actor.

    Parameters
    ----------
    engine    : SQLAlchemy engine
    case_id   : UUID string of the case
    outcome   : dict with any of:
                  surgical_score (1-5), complications (0/1), mobility_goals,
                  nutrition_plan, medication_reconciliation, notes, team_score
    logged_by : user identity (from IAP or local dev email)

    Returns
    -------
    dict with summary: how many relationships updated, how many actors nudged
    """
    surgical_score = outcome.get("surgical_score", 0)
    team_score     = outcome.get("team_score", surgical_score)

    with engine.connect() as conn:
        # Get all non-blocked relationships for this case
        rels = conn.execute(
            sqlalchemy.text("""
                SELECT id, actor_a_id, actor_b_id, relationship_type, state
                FROM relationships
                WHERE case_id = :case_id
                  AND state NOT IN ('compliance_blocked', 'cancelled')
            """),
            {"case_id": case_id},
        ).mappings().fetchall()

    if not rels:
        return {"relationships_updated": 0, "actors_nudged": 0, "warning": "No relationships found for this case"}

    now_iso = datetime.now(timezone.utc).isoformat()
    outcome_record = {**outcome, "logged_at": now_iso, "logged_by": logged_by}

    actor_ids: set[str] = set()
    updated_rels = 0

    with engine.begin() as conn:
        for rel in rels:
            rel_id = str(rel["id"])
            # Write outcome_record to the relationship
            conn.execute(
                sqlalchemy.text("""
                    UPDATE relationships
                    SET outcome_record = :outcome::jsonb,
                        state          = CASE WHEN state = 'active' THEN 'completed' ELSE state END,
                        updated_at     = now()
                    WHERE id = :id
                """),
                {"outcome": json.dumps(outcome_record), "id": rel_id},
            )

            # Write audit log entry
            conn.execute(
                sqlalchemy.text("""
                    INSERT INTO audit_logs
                        (case_id, relationship_id, action, previous_state, next_state,
                         actor_user, reason, metadata)
                    VALUES
                        (:case_id, :rel_id, 'outcome_logged', 'active', 'completed',
                         :user, :reason, :meta::jsonb)
                """),
                {
                    "case_id": case_id,
                    "rel_id":  rel_id,
                    "user":    logged_by,
                    "reason":  f"Outcome logged: score {surgical_score}/5",
                    "meta":    json.dumps(outcome_record),
                },
            )

            # Collect all actor IDs involved in this case
            actor_ids.add(str(rel["actor_a_id"]))
            actor_ids.add(str(rel["actor_b_id"]))
            updated_rels += 1

    # Nudge outcome_weight for every involved actor
    nudge = _compute_nudge(surgical_score, team_score, outcome)
    actors_nudged = _apply_weight_nudge(engine, list(actor_ids), nudge, logged_by)

    print(f"[outcome] case={case_id} updated {updated_rels} relationships, "
          f"nudged {actors_nudged} actors by {nudge:+.2f}")

    return {
        "relationships_updated": updated_rels,
        "actors_nudged":         actors_nudged,
        "nudge_applied":         nudge,
        "outcome_summary":       outcome_record,
    }


def _compute_nudge(surgical_score: int, team_score: int, outcome: dict) -> float:
    """Decide how much to adjust outcome_weight based on the outcome."""
    complications = outcome.get("complications", 0)

    if surgical_score >= 4 and complications == 0:
        return WEIGHT_NUDGE_GOOD
    elif surgical_score <= 2 or complications > 0:
        return -WEIGHT_NUDGE_BAD
    else:
        return 0.0  # neutral — no change


def _apply_weight_nudge(
    engine: sqlalchemy.engine.Engine,
    actor_ids: list[str],
    nudge: float,
    logged_by: str,
) -> int:
    """Apply the nudge to each actor's outcome_weight, respecting min/max caps."""
    if not actor_ids or nudge == 0.0:
        return 0

    updated = 0
    with engine.begin() as conn:
        for actor_id in actor_ids:
            conn.execute(
                sqlalchemy.text("""
                    UPDATE actors
                    SET outcome_weight = GREATEST(:min_w, LEAST(:max_w, outcome_weight + :nudge)),
                        updated_at     = now()
                    WHERE id = :id
                """),
                {
                    "min_w": WEIGHT_MIN,
                    "max_w": WEIGHT_MAX,
                    "nudge": nudge,
                    "id":    actor_id,
                },
            )
            updated += 1

    return updated


# ── CLI entry point (demo / testing) ─────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Log an outcome for a CareLink case.")
    parser.add_argument(
        "--case-id",
        default="10000000-0000-4000-8000-000000000001",
        help="UUID of the case to log outcome for (default: Encik Zainal demo case).",
    )
    parser.add_argument("--score",        type=int, default=5, help="Surgical score 1-5 (default 5).")
    parser.add_argument("--complications",type=int, default=0, help="Complications count (default 0).")
    parser.add_argument("--notes",        type=str, default="No post-operative complications. Discharge day 6.")
    parser.add_argument("--logged-by",    type=str, default="demo@carelink.test")
    args = parser.parse_args()

    outcome = {
        "surgical_score":        args.score,
        "team_score":            args.score,
        "complications":         args.complications,
        "mobility_goals":        "met" if args.score >= 4 else "partial",
        "medication_reconciliation": "completed",
        "notes":                 args.notes,
    }

    engine = _build_engine()
    result = log_outcome(engine, case_id=args.case_id, outcome=outcome, logged_by=args.logged_by)
    print(json.dumps(result, indent=2, default=str))
