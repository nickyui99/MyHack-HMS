# CareLink Backend

Node.js + Express backend for Member 2. It exposes the API contract for actors, cases, relationships, matching, outcomes, and audit logs.

## Local run

```powershell
cd backend
npm install
npm run dev
```

Open:

- API health: `http://127.0.0.1:8000/health`
- OpenAPI spec: `http://127.0.0.1:8000/openapi.json`

Local mode accepts requests without IAP. With the default `.env.local`, the API uses a local SQLite file at `backend/data/carelink.sqlite` so test data persists across restarts. If no database settings are configured, it falls back to the in-memory demo store.

## Environment files

The backend loads environment variables from `backend/.env.local` first, then `backend/.env`.
Shell environment variables still win. Use `CARELINK_ENV_FILE=C:\path\to\file.env` to load a specific file.

Copy the template when setting up a machine:

```powershell
copy .env.example .env.local
```

To run the same API against Postgres locally, set `CARELINK_DATABASE_URL` before starting the server:

```powershell
cd backend
$env:CARELINK_DATABASE_URL="postgres://USER:PASSWORD@HOST:5432/carelink"
cmd /c npm run dev
```

When `CARELINK_SQLITE_PATH` is set, actors, cases, relationships, match runs, and audit logs are read from and written to SQLite. SQLite takes precedence over Postgres/Cloud SQL settings. When `CARELINK_DATABASE_URL` is set and SQLite is not set, the API uses Postgres. Without any database setting, the API falls back to the in-memory demo store.

## Local SQLite

SQLite is the fastest backend API testing mode. It uses Node's built-in `node:sqlite` module, creates the schema automatically, and seeds 50 demo actors plus sample cases on first use.

```powershell
cd backend
cmd /c npm run smoke:sqlite
cmd /c npm run test:endpoints
cmd /c npm run dev
```

To start with fresh local data, stop the server and delete `backend/data/carelink.sqlite`; it will be recreated on the next run.

`npm run test:endpoints` starts the API on a random local port and calls every endpoint in `openapi.json`. To test an already running server instead, set `CARELINK_TEST_BASE_URL`:

```powershell
$env:CARELINK_TEST_BASE_URL="http://127.0.0.1:8000"
cmd /c npm run test:endpoints
```

## API endpoints

Base URLs:

- Local: `http://127.0.0.1:8000`
- Cloud Run prototype: `https://carelink-api-305487732751.asia-southeast1.run.app`

The lightweight OpenAPI document is available at `GET /openapi.json`. In local/prototype mode, write endpoints accept requests without IAP and use `CARELINK_LOCAL_USER_EMAIL` unless `x-carelink-local-user` is provided.

### Health and contract

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Returns service health. |
| `GET` | `/openapi.json` | Returns the lightweight API contract. |

Example:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

### Actors

Actors represent doctors, nurses, allied health staff, departments, hospitals, vendors, and coordinators.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/actors` | List actors. |
| `GET` | `/actors?role=cardiologist` | Filter by role. |
| `GET` | `/actors?specialty=cardiology` | Filter by specialty. |
| `GET` | `/actors?hospital=Sunway%20Medical%20Centre` | Filter by hospital. |
| `GET` | `/actors?available=true` | Return actors with `available` or `limited` capacity. |
| `GET` | `/actors/:actorId` | Get one actor. |
| `POST` | `/actors` | Create an actor. |

Create actor body:

```json
{
  "actor_type": "specialist",
  "name": "Dr Endpoint Demo",
  "role": "cardiologist",
  "specialty": "cardiology",
  "subspecialty": "interventional_cardiology",
  "hospital": "Sunway Medical Centre",
  "department": "Cardiology",
  "location": "Bandar Sunway",
  "insurance_panels": ["Prudential BSN"],
  "languages": ["English", "Malay"],
  "credentials": { "mmc": "MMC-DEMO" },
  "apc_number": "APC-2026-DEMO",
  "apc_expiry_date": "2026-12-31",
  "capacity_status": "available",
  "outcome_weight": 1.05,
  "profile_text": "Demo cardiologist for endpoint testing."
}
```

### Cases

Cases represent a patient journey or coordination request.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/cases` | List cases. |
| `GET` | `/cases?case_stage=referral` | Filter by case stage. |
| `GET` | `/cases/:caseId` | Get one case. |
| `POST` | `/cases` | Create a case. |

Create case body:

```json
{
  "patient_name": "Encik Demo",
  "patient_age": 58,
  "patient_gender": "male",
  "diagnosis": "NSTEMI",
  "case_stage": "referral",
  "payer": "Prudential BSN",
  "location": "Puchong",
  "urgency": "urgent",
  "clinical_context": {
    "risk_factors": ["diabetes", "hypertension"],
    "procedure": "CABG"
  }
}
```

### Relationships

Relationships are the core coordination records: who is connected, for which case, why, state, compliance, scores, and outcomes.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/relationships` | List relationships. |
| `GET` | `/relationships?case_id=:caseId` | Filter by case. |
| `GET` | `/relationships?state=proposed` | Filter by state. |
| `POST` | `/relationships` | Create a relationship and run compliance checks. |
| `PATCH` | `/relationships/:relationshipId/state` | Update relationship state. |

Create relationship body:

```json
{
  "case_id": "CASE_UUID",
  "relationship_type": "gp_to_specialist_referral",
  "actor_a_id": "SOURCE_ACTOR_UUID",
  "actor_b_id": "TARGET_ACTOR_UUID",
  "match_score": 91.5,
  "score_breakdown": { "endpoint_test": true },
  "case_context": { "reason": "NSTEMI referral" }
}
```

Update state body:

```json
{
  "state": "active",
  "reason": "Coordinator approved the referral."
}
```

Common states are `proposed`, `active`, `completed`, and `compliance_blocked`.

### Matching

Matching endpoints use deterministic demo logic today. They select seeded actors by role, sort by `outcome_weight`, evaluate compliance, optionally create relationships, and persist a match run.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/match/referral` | Recommend cardiologists for a referral. |
| `POST` | `/match/surgical-team` | Recommend surgical team members. |
| `POST` | `/match/allied-health` | Recommend allied health team members. |

Match body:

```json
{
  "case_id": "CASE_UUID",
  "requested_by_actor_id": "SOURCE_ACTOR_UUID",
  "create_relationships": true,
  "context": {
    "source": "demo",
    "notes": "Patient needs urgent referral."
  }
}
```

Response shape:

```json
{
  "match_type": "referral",
  "case_id": "CASE_UUID",
  "recommended_actor_ids": ["ACTOR_UUID"],
  "recommended_relationship_ids": ["RELATIONSHIP_UUID"],
  "match_score": 94.4,
  "score_breakdown": {
    "vector_similarity": 0.82,
    "rule_compliance": 1,
    "outcome_weight": 1.18,
    "deterministic_demo": true
  },
  "compliance_result": {
    "status": "passed",
    "passed": true,
    "flags": { "selected_count": 1 },
    "blocked_reasons": []
  },
  "explanation": "referral match generated from seeded CareLink actors."
}
```

### Outcomes

Outcomes complete one or more relationships and write audit events.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/outcomes` | Log outcome records for relationships. |

Body:

```json
{
  "relationship_ids": ["RELATIONSHIP_UUID"],
  "outcome_record": {
    "clinical_outcome": "Referral completed",
    "appropriateness_score": 5
  },
  "reason": "Case closed after successful handover."
}
```

### Audit

Audit logs capture relationship creation, compliance blocks, state changes, and outcome logging.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/audit` | List audit logs. |
| `GET` | `/audit?case_id=:caseId` | Filter audit logs by case. |
| `GET` | `/audit?relationship_id=:relationshipId` | Filter audit logs by relationship. |

### Full endpoint test

Run this script to call every endpoint and fail fast on contract regressions:

```powershell
cd backend
cmd /c npm run test:endpoints
```

Against the deployed Cloud Run API:

```powershell
$env:CARELINK_TEST_BASE_URL="https://carelink-api-305487732751.asia-southeast1.run.app"
cmd /c npm run test:endpoints
```

## Cloud SQL

The production schema is in `migrations/001_init.sql`. Use Cloud SQL IAM database auth in deployment. Do not add DB passwords or service-account JSON files.

For this project, `backend/.env.local` is configured for:

```text
CARELINK_CLOUD_SQL_INSTANCE=hackathon-myhack:asia-southeast1:postgres
CARELINK_DB_NAME=carelink
CARELINK_DB_USER=carelink-runtime@hackathon-myhack.iam
CARELINK_CLOUD_SQL_IP_TYPE=PUBLIC
CARELINK_IMPERSONATE_SERVICE_ACCOUNT=carelink-runtime@hackathon-myhack.iam.gserviceaccount.com
```

For PostgreSQL IAM service accounts, the database username omits `.gserviceaccount.com`. The backend uses `CARELINK_IMPERSONATE_SERVICE_ACCOUNT` so local ADC can impersonate the runtime service account.

Before running locally with impersonation, sign in once with Application Default Credentials:

```powershell
cmd /c gcloud auth application-default login
```

Your Google user also needs `roles/iam.serviceAccountTokenCreator` on the runtime service account.

The IAM database service account must also have table privileges. Run `migrations/003_grant_cloudsql_iam_user.sql` once as the database owner or a privileged PostgreSQL user.

## Cloud Run SQLite prototype

The prototype API is deployed to Cloud Run with SQLite enabled at:

```txt
https://carelink-api-305487732751.asia-southeast1.run.app
```

Deploy from the repository root:

```powershell
cmd /c gcloud builds submit --project hackathon-myhack --config infra\cloudbuild.yaml .
```

The Cloud Run deployment sets:

```txt
CARELINK_ENVIRONMENT=cloud
CARELINK_IAP_REQUIRED=false
CARELINK_SQLITE_PATH=/tmp/carelink.sqlite
```

This is intentionally prototype-only. The SQLite file lives on the Cloud Run instance filesystem, so data can reset when the instance restarts or a new revision is deployed. The deployment also caps the service at one instance to avoid each instance having a different local SQLite database.

Verify the deployed API:

```powershell
$env:CARELINK_TEST_BASE_URL="https://carelink-api-305487732751.asia-southeast1.run.app"
cmd /c npm run test:endpoints
```

## Database scripts

Run the schema first, then demo seed data:

```powershell
psql "YOUR_POSTGRES_CONNECTION_STRING" -f migrations/001_init.sql
psql "YOUR_POSTGRES_CONNECTION_STRING" -f migrations/002_seed_demo.sql
psql "YOUR_POSTGRES_CONNECTION_STRING" -f migrations/003_grant_cloudsql_iam_user.sql
psql "YOUR_POSTGRES_CONNECTION_STRING" -f migrations/verify_demo.sql
```

If you do not already have Postgres with pgvector available, start the included local container:

```powershell
cd backend
cmd /c docker compose up -d
cmd /c docker compose exec -T postgres psql -U carelink -d carelink -f /migrations/001_init.sql
cmd /c docker compose exec -T postgres psql -U carelink -d carelink -f /migrations/002_seed_demo.sql
cmd /c docker compose exec -T postgres psql -U carelink -d carelink -f /migrations/verify_demo.sql
$env:CARELINK_DATABASE_URL="postgres://carelink:carelink@127.0.0.1:5432/carelink"
cmd /c npm run smoke:db
cmd /c npm run dev
```

After seeding, verify the backend is using the database:

```powershell
$env:CARELINK_DATABASE_URL="postgres://USER:PASSWORD@HOST:5432/carelink"
cmd /c npm run smoke:db
```

`002_seed_demo.sql` inserts:

- 50 Malaysian-context demo actors
- Encik Zainal hero case
- two additional demo cases
- referral, CABG team, allied health, and expired-APC blocked relationships
- match run records with score breakdowns
- audit log events for governance/demo proof
