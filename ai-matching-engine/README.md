# CareLink AI Matching Engine

Built by Member 3. This is a FastAPI service that uses Vertex AI embeddings + pgvector to rank doctors, nurses, and allied health staff for a patient case. It runs on Cloud Run and is called by Member 2's Node.js backend and Member 4's ADK chatbot.

---

## What it does

1. **Embeddings** — converts every actor's profile text into a 768-dimensional vector using Google's `text-embedding-005` model and stores it in Cloud SQL (pgvector)
2. **Retrieval** — when a patient case comes in, embeds the case description and finds the most semantically similar actors using cosine similarity
3. **Scoring** — ranks candidates by a composite score: `55% vector similarity + 25% compliance rules + 20% historical outcome weight`
4. **Outcome feedback** — after a case closes, nudges each involved actor's weight up or down based on the outcome score so future recommendations improve

---

## Files

| File | What it does |
|------|-------------|
| `main.py` | FastAPI app — the HTTP endpoints your teammates call |
| `retrieval.py` | Core vector search logic — find best actors for a case |
| `embeddings.py` | One-time setup script — generates and stores actor embeddings |
| `outcome_weights.py` | Outcome feedback loop — updates actor weights after a case |
| `ekg_reconciliation.py` | Entity reconciliation (production architecture reference, not run in hackathon) |
| `Dockerfile` | Container definition for Cloud Run |
| `requirements.txt` | Python dependencies |
| `INTEGRATION.md` | Instructions for Member 2 on wiring into match.js |

---

## Endpoints

Base URL (Cloud Run): `https://carelink-match-service-305487732751.asia-southeast1.run.app`

### `GET /health`
Health check.
```json
{ "status": "ok", "service": "carelink-match-service" }
```

### `POST /match/referral`
Find the best cardiologists for a GP referral.

Request:
```json
{
  "case_ctx": {
    "diagnosis": "NSTEMI",
    "payer": "Prudential BSN",
    "location": "Puchong",
    "urgency": "urgent"
  },
  "top_n": 3
}
```

Response: ranked list of cardiologists with `score`, `score_breakdown`, insurance panels, APC number, capacity status.

### `POST /match/surgical-team`
Find the best anaesthetist, scrub nurse, and perfusionist for a CABG procedure.

Request:
```json
{
  "case_ctx": {
    "diagnosis": "triple vessel disease",
    "procedure": "CABG",
    "payer": "Prudential BSN",
    "location": "Kuala Lumpur"
  },
  "top_n": 2
}
```

Response: candidates grouped by role + a `recommended_team` (top pick per role) + `team_score` with historical pair bonus.

### `POST /match/allied-health`
Find the best physiotherapist, dietitian, and pharmacist for post-CABG recovery.

Request:
```json
{
  "case_ctx": {
    "diagnosis": "post-CABG recovery",
    "procedure": "CABG",
    "location": "Kuala Lumpur"
  },
  "top_n": 2
}
```

### `POST /outcomes`
Log a case outcome and update every involved actor's weight. Called by Member 4's chatbot after the coordinator says something like "Log outcome for Encik Zainal: surgical 5/5, no complications."

Request:
```json
{
  "case_id": "10000000-0000-4000-8000-000000000001",
  "surgical_score": 5,
  "complications": 0,
  "mobility_goals": "met",
  "notes": "No post-op complications. Discharge day 6.",
  "logged_by": "coordinator@carelink.test"
}
```

Response: how many relationships were updated, how many actor weights were nudged, and by how much.

---

## How the score works

Every candidate gets a score breakdown:

| Component | Weight | Meaning |
|-----------|--------|---------|
| `vector_similarity` | 55% | How well the actor's profile matches the case semantically |
| `rule_compliance` | 25% | APC valid, capacity available, on correct insurance panel |
| `outcome_weight` | 20% | Historical performance from past cases |

Hard failures (expired APC, full capacity) exclude the actor entirely regardless of score.

---

## Knowledge graph (relationships table)

The `relationships` table in Cloud SQL is the knowledge graph. Each row is an edge:

```
GP ──referred──> Cardiologist       (case: Encik Zainal)
Surgeon ──operated_with──> Anaesthetist  (case: Encik Zainal)
```

- **Member 2's backend** creates relationship rows when a referral or team assignment is approved
- **This matching engine** reads actor nodes to find the best candidates
- **`POST /outcomes`** reads relationship edges to find who was involved, then updates their weights

The 9 demo relationships for Encik Zainal's case are seeded in `backend/migrations/002_seed_demo.sql`.

---

## Local development

**Prerequisites:** Python 3.11+, `gcloud auth application-default login`

```cmd
cd ai-matching-engine
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in values (ask Member 2 for the DB password).

Run the service locally:
```cmd
uvicorn main:app --reload --port 8001
```

Open `http://localhost:8001/docs` for interactive Swagger UI.

Run embeddings (one-time setup, needs ADC + DB access):
```cmd
python embeddings.py --dry-run   # preview only
python embeddings.py             # embed actors missing a vector
python embeddings.py --force     # re-embed all actors
```

---

## Deployment

```cmd
gcloud run deploy carelink-match-service --source . --region asia-southeast1 --allow-unauthenticated --add-cloudsql-instances hackathon-myhack:asia-southeast1:postgres --set-env-vars GCP_PROJECT=hackathon-myhack,GCP_REGION=asia-southeast1,CLOUD_SQL_CONN=hackathon-myhack:asia-southeast1:postgres,DB_NAME=carelink,DB_USER=postgres --set-secrets DB_PASSWORD=db-password:latest --project hackathon-myhack
```

See `INTEGRATION.md` for how Member 2 wires the returned URL into `match.js`.
