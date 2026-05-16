"""
Google Enterprise Knowledge Graph (EKG) entity reconciliation for CareLink.

What this does (plain English):
  Hospital databases have messy data. The same doctor might appear as
  "Dr Suresh Ramasamy" in one system and "Dr S Ramasamy" in another.
  This script asks Google's Knowledge Graph: "Is this person a known entity?"
  and gets back a clean, canonical ID — so the relationship graph doesn't
  have duplicates of the same person.

  We use EKG in two ways:
    1. reconcile_actors() — for each actor in the DB, ask EKG to find the
       matching real-world entity (e.g. a hospital, a medical school) and
       store the canonical EKG ID.
    2. lookup_entity()    — quick point lookup for a single name/type.

  For the hackathon demo: run reconcile_actors() once during setup.
  The canonical entity IDs are written to the actors.credentials JSONB column.

Auth: Application Default Credentials (ADC) — no API key.
  The carelink-runtime service account needs roles/enterpriseknowledgegraph.admin.

How to run:
  python ekg_reconciliation.py                    # reconcile all actors in DB
  python ekg_reconciliation.py --dry-run          # print what would happen
  python ekg_reconciliation.py --name "Sunway"    # lookup a single name
"""
from __future__ import annotations

import argparse
import json
import os

from dotenv import load_dotenv
load_dotenv()

import sqlalchemy
from google.cloud import enterpriseknowledgegraph as ekg


# ── Config ────────────────────────────────────────────────────────────────────

GCP_PROJECT    = os.environ.get("GCP_PROJECT",  "carelink-hackathon")
GCP_REGION     = os.environ.get("GCP_REGION",   "asia-southeast1")
# EKG only supports global or us-central1; use global for widest coverage
EKG_LOCATION   = "global"

CLOUD_SQL_CONN = os.environ.get(
    "CLOUD_SQL_CONN",
    f"{GCP_PROJECT}:{GCP_REGION}:carelink-db"
)
DB_NAME     = os.environ.get("DB_NAME", "carelink")
DB_USER     = os.environ.get("DB_USER", "postgres")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "")

# Entity types we search for in EKG by actor_type
_ACTOR_TYPE_TO_EKG_TYPE = {
    "specialist":      "Person",
    "surgeon":         "Person",
    "anaesthetist":    "Person",
    "gp":              "Person",
    "physiotherapist": "Person",
    "dietitian":       "Person",
    "pharmacist":      "Person",
    "nurse":           "Person",
    "coordinator":     "Person",
    "hospital":        "MedicalOrganization",
    "department":      "MedicalOrganization",
    "vendor":          "Organization",
}


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


# ── EKG helpers ───────────────────────────────────────────────────────────────

def _ekg_client():
    """Returns an EnterpriseKnowledgeGraphServiceClient using ADC."""
    return ekg.EnterpriseKnowledgeGraphServiceClient()


def lookup_entity(name: str, entity_type: str = "Person") -> dict | None:
    """
    Search EKG for a single entity by name.

    Returns the top match as a dict with keys:
      name, mid (EKG ID), types, description, score
    or None if nothing found.
    """
    client = _ekg_client()
    parent = f"projects/{GCP_PROJECT}/locations/{EKG_LOCATION}"

    request = ekg.SearchPublicKgRequest(
        parent=parent,
        query=name,
        types=[entity_type],
        languages=["en"],
        num_result_items=1,
    )

    try:
        response = client.search_public_kg(request=request)
    except Exception as exc:
        print(f"  [ekg] lookup failed for {name!r}: {exc}")
        return None

    items = list(response.item_list_element)
    if not items:
        return None

    item = items[0]
    result = getattr(item, "result", None)
    if result is None:
        return None

    return {
        "name":        getattr(result, "name", name),
        "mid":         getattr(result, "mid", None),
        "types":       list(getattr(result, "types", [])),
        "description": getattr(result, "description", ""),
        "score":       getattr(item, "result_score", 0.0),
    }


# ── Batch reconciliation ──────────────────────────────────────────────────────

def reconcile_actors(engine: sqlalchemy.engine.Engine, dry_run: bool = False):
    """
    For each actor in the database:
      1. Search EKG by actor name and type.
      2. If a match is found, store the EKG entity ID in credentials['ekg_mid'].

    Hospitals and departments are especially useful to reconcile because EKG
    knows their official names, locations, and organisational hierarchy.
    This prevents the relationship graph from having duplicate hospital nodes
    when data comes from multiple source systems.
    """
    with engine.connect() as conn:
        rows = conn.execute(
            sqlalchemy.text(
                "SELECT id, name, actor_type, hospital, credentials FROM actors ORDER BY name"
            )
        ).mappings().fetchall()

    print(f"[ekg] Reconciling {len(rows)} actors...")
    reconciled = 0

    for row in rows:
        actor_type  = row["actor_type"]
        name        = row["name"]
        actor_id    = str(row["id"])
        credentials = row["credentials"] or {}

        # Skip if already reconciled
        if credentials.get("ekg_mid"):
            print(f"  skip (already reconciled): {name!r}")
            continue

        ekg_type = _ACTOR_TYPE_TO_EKG_TYPE.get(actor_type, "Thing")

        # For hospitals/departments, search by hospital name (more findable in EKG)
        search_name = row["hospital"] if actor_type in ("hospital", "department") else name

        entity = lookup_entity(search_name, ekg_type)

        if entity:
            print(f"  matched: {name!r} → EKG mid={entity['mid']!r} ({entity['description'][:60]})")
            if not dry_run:
                updated_creds = {**credentials, "ekg_mid": entity["mid"], "ekg_name": entity["name"]}
                with engine.begin() as wconn:
                    wconn.execute(
                        sqlalchemy.text(
                            "UPDATE actors SET credentials = :creds::jsonb, updated_at = now() "
                            "WHERE id = :id"
                        ),
                        {"creds": json.dumps(updated_creds), "id": actor_id},
                    )
            reconciled += 1
        else:
            print(f"  no EKG match: {name!r} (type={ekg_type})")

    action = "would have reconciled" if dry_run else "reconciled"
    print(f"[ekg] Done. {action} {reconciled}/{len(rows)} actors.")


# ── CLI entry point ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="EKG entity reconciliation for CareLink actors.")
    parser.add_argument("--dry-run", action="store_true", help="Print matches without writing to DB.")
    parser.add_argument("--name",    type=str, default=None,
                        help="Look up a single name and print the EKG match (no DB needed).")
    parser.add_argument("--type",    type=str, default="Person",
                        help="EKG entity type for --name lookup (default: Person).")
    args = parser.parse_args()

    if args.name:
        result = lookup_entity(args.name, args.type)
        if result:
            print(json.dumps(result, indent=2))
        else:
            print(f"No EKG match found for {args.name!r}")
    else:
        engine = _build_engine()
        reconcile_actors(engine, dry_run=args.dry_run)
