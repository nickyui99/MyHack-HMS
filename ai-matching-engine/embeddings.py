"""
Vertex AI text-embedding-005 pipeline for CareLink actors.

What this does (plain English):
  Each doctor/nurse/allied health actor has a `profile_text` field in the database
  describing who they are. This script turns that text into a list of 768 numbers
  (called a vector or embedding) using Google's AI. Those numbers capture the
  *meaning* of the profile so we can later find the most similar doctor for a
  given patient case just by comparing numbers — no keyword matching needed.

How to run:
  python embeddings.py                  # embed all actors missing a vector
  python embeddings.py --force          # re-embed every actor even if already done
  python embeddings.py --dry-run        # print what would happen without writing

Auth: uses Application Default Credentials (ADC). No API key needed.
  On Cloud Run this is automatic. Locally run:
    gcloud auth application-default login
"""
from __future__ import annotations

import argparse
import os
import sys
import time

from dotenv import load_dotenv
load_dotenv()  # loads .env if present; safe to call even if file doesn't exist

import vertexai
from vertexai.language_models import TextEmbeddingInput, TextEmbeddingModel
from google.cloud.sql.connector import Connector
import sqlalchemy
import pg8000


# ── Config (read from environment, with sensible defaults for local dev) ──────

GCP_PROJECT   = os.environ.get("GCP_PROJECT",   "carelink-hackathon")
GCP_REGION    = os.environ.get("GCP_REGION",    "asia-southeast1")
# Format: project:region:instance-name
CLOUD_SQL_CONN = os.environ.get(
    "CLOUD_SQL_CONN",
    f"{GCP_PROJECT}:{GCP_REGION}:carelink-db"
)
DB_NAME       = os.environ.get("DB_NAME",   "carelink")
DB_USER       = os.environ.get("DB_USER",   "postgres")
DB_PASSWORD   = os.environ.get("DB_PASSWORD", "")  # set in .env, never commit the real value

EMBEDDING_MODEL = "text-embedding-005"
EMBEDDING_DIMS  = 768
BATCH_SIZE      = 20   # Vertex AI allows up to 250; keep small to avoid quota bursts
RETRY_WAIT_SEC  = 5


# ── Database connection (password auth for local/hackathon setup) ─────────────

def _build_engine() -> sqlalchemy.engine.Engine:
    connector = Connector()

    def _getconn():
        return connector.connect(
            CLOUD_SQL_CONN,
            "pg8000",
            user=DB_USER,
            password=DB_PASSWORD,
            db=DB_NAME,
        )

    engine = sqlalchemy.create_engine(
        "postgresql+pg8000://",
        creator=_getconn,
        pool_pre_ping=True,
    )
    return engine


# ── Vertex AI embedding call ──────────────────────────────────────────────────

def _init_vertex():
    vertexai.init(project=GCP_PROJECT, location=GCP_REGION)
    # ADC picks up credentials automatically — no key file, no parameter needed


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Call Vertex AI text-embedding-005 and return one vector per text."""
    model = TextEmbeddingModel.from_pretrained(EMBEDDING_MODEL)
    inputs = [TextEmbeddingInput(t, "RETRIEVAL_DOCUMENT") for t in texts]
    results = model.get_embeddings(inputs, output_dimensionality=EMBEDDING_DIMS)
    return [r.values for r in results]


# ── Main pipeline ─────────────────────────────────────────────────────────────

def run(force: bool = False, dry_run: bool = False):
    print(f"[embeddings] project={GCP_PROJECT} region={GCP_REGION}")
    print(f"[embeddings] cloud_sql={CLOUD_SQL_CONN} db={DB_NAME} user={DB_USER}")
    print(f"[embeddings] force={force} dry_run={dry_run}")

    _init_vertex()
    engine = _build_engine()

    with engine.connect() as conn:
        # Fetch actors that need embedding
        if force:
            rows = conn.execute(
                sqlalchemy.text("SELECT id, name, profile_text FROM actors ORDER BY name")
            ).fetchall()
        else:
            # Only actors whose embedding column is NULL
            rows = conn.execute(
                sqlalchemy.text(
                    "SELECT id, name, profile_text FROM actors "
                    "WHERE embedding IS NULL ORDER BY name"
                )
            ).fetchall()

        if not rows:
            print("[embeddings] All actors already have embeddings. Use --force to re-embed.")
            return

        print(f"[embeddings] {len(rows)} actor(s) to embed.")

        if dry_run:
            for r in rows:
                print(f"  would embed: {r.name!r} (id={r.id})")
            print("[embeddings] Dry run — nothing written.")
            return

        # Process in batches to respect Vertex AI quota
        total_done = 0
        for batch_start in range(0, len(rows), BATCH_SIZE):
            batch = rows[batch_start : batch_start + BATCH_SIZE]
            texts = []
            for row in batch:
                # Use profile_text if present, otherwise fall back to name only
                text = (row.profile_text or row.name or "").strip()
                if not text:
                    text = f"Clinical actor id {row.id}"
                texts.append(text)

            # Retry once on transient errors
            for attempt in range(2):
                try:
                    vectors = embed_texts(texts)
                    break
                except Exception as exc:
                    if attempt == 0:
                        print(f"  [warn] Vertex AI error, retrying in {RETRY_WAIT_SEC}s: {exc}")
                        time.sleep(RETRY_WAIT_SEC)
                    else:
                        print(f"  [error] Failed batch {batch_start}–{batch_start+len(batch)}: {exc}")
                        raise

            # Write vectors back to Cloud SQL
            with engine.begin() as write_conn:
                for row, vector in zip(batch, vectors):
                    # pgvector expects a Python list; cast to string for pg8000
                    vec_str = "[" + ",".join(str(v) for v in vector) + "]"
                    write_conn.execute(
                        sqlalchemy.text(
                            "UPDATE actors SET embedding = CAST(:vec AS vector), updated_at = now() "
                            "WHERE id = :id"
                        ),
                        {"vec": vec_str, "id": str(row.id)},
                    )
                    print(f"  embedded: {row.name!r}")

            total_done += len(batch)
            print(f"  [progress] {total_done}/{len(rows)} done")

        print(f"[embeddings] Complete. {total_done} actor(s) embedded.")

        # Create the ivfflat index once all embeddings are loaded
        # (safe to run multiple times — IF NOT EXISTS guards it)
        print("[embeddings] Creating/verifying pgvector ivfflat index...")
        with engine.begin() as idx_conn:
            idx_conn.execute(sqlalchemy.text(
                "CREATE INDEX IF NOT EXISTS idx_actors_embedding "
                "ON actors USING ivfflat (embedding vector_cosine_ops) "
                "WITH (lists = 10)"
                # lists=10 is fine for 50 actors; increase to 100 for production
            ))
        print("[embeddings] Index ready.")


# ── CLI entry point ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate Vertex AI embeddings for all actors.")
    parser.add_argument("--force",   action="store_true", help="Re-embed all actors, not just missing ones.")
    parser.add_argument("--dry-run", action="store_true", help="Print what would happen without writing.")
    args = parser.parse_args()
    run(force=args.force, dry_run=args.dry_run)
