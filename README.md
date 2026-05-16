# CareLink

Hospital ecosystem coordination, reimagined.

CareLink is an AI-powered hospital coordination platform for MyHack 2026 KL. It treats every hospital linkage, from GP referral to surgical team assembly to allied health coordination, as a structured relationship entity that can be matched, governed, audited, and improved over time.

The project is built around the Cradle problem statement: automating ecosystem linkages instead of relying on manual coordination calls, informal staff memory, and one-off assignments.

## Problem

Hospitals are dense operational ecosystems. A single patient journey can require a GP, specialist, surgeon, anaesthetist, nursing team, physiotherapist, dietitian, pharmacist, coordinator, and payer context to align quickly.

Today, those relationships are often coordinated manually:

- a GP calls around to find a suitable specialist
- a surgical coordinator spends 30-45 minutes assembling an operating team
- ward staff page allied health teams without structured capacity or specialty matching
- outcome learning is lost after the case closes

CareLink makes those relationships first-class system entities.

## Core Idea

Every clinical linkage is represented as a `Relationship`:

- who is connected
- which case triggered the relationship
- what type of relationship it is
- whether compliance passed
- why the match was recommended
- what state the relationship is in
- what outcome was recorded after completion

This turns hospital coordination into a programmable, auditable, reusable ecosystem graph.

## Demo Journey

The demo follows Encik Zainal, 58, through three care stages:

1. **Referral matching**
   - GP Dr Amirul refers a suspected NSTEMI patient to the best-fit cardiologist.
   - Matching considers specialty, payer, location, credential validity, capacity, and outcome history.

2. **Surgical team assembly**
   - The system assembles a CABG team for a 7am procedure.
   - Compliance checks block expired credentials and unavailable staff.

3. **Allied health coordination**
   - The ward coordinates post-CABG physiotherapy, dietetics, and pharmacy review.
   - The outcome loop writes results back to the relationship records.

## Current Repository Structure

```txt
.
+-- backend/                 # Node.js Express API for Member 2
|   +-- src/                 # Routes, services, config, in-memory demo store
|   +-- migrations/          # PostgreSQL + pgvector schema
|   +-- scripts/             # Smoke test
|   +-- Dockerfile           # Cloud Run container
|   +-- README.md
+-- doc/
|   +-- database-structure.md
+-- infra/
|   +-- terraform/           # GCP API enablement, service account, IAM, Artifact Registry
|   +-- cloudbuild.yaml      # Backend build/deploy pipeline
|   +-- iam-bindings.sh      # gcloud IAM helper script
+-- frontend/                # Frontend workspace placeholder
+-- adk/                     # Google ADK agents workspace placeholder
+-- ai-matching-engine/      # Matching/embedding workspace placeholder
+-- CareLink_Team_Plan.md
```

## Implemented Backend

The backend is currently implemented in JavaScript using Node.js and Express.

Available endpoints:

| Endpoint | Purpose |
|---|---|
| `GET /health` | Service health check |
| `GET /openapi.json` | Lightweight API contract |
| `GET /actors` | List/filter clinical actors |
| `POST /actors` | Create actor |
| `GET /cases` | List cases |
| `POST /cases` | Create case |
| `GET /relationships` | List relationship entities |
| `POST /relationships` | Create relationship with compliance gate |
| `PATCH /relationships/:id/state` | Update relationship state |
| `POST /match/referral` | Run referral match |
| `POST /match/surgical-team` | Run surgical team match |
| `POST /match/allied-health` | Run allied health match |
| `POST /outcomes` | Log outcome records |
| `GET /audit` | View audit logs |

Local mode uses an in-memory seeded store so frontend, ADK, and matching work can start immediately. The production schema is defined separately for Cloud SQL PostgreSQL.

## Database

The database target is Cloud SQL for PostgreSQL with `pgvector`.

Main tables:

- `actors`
- `cases`
- `relationships`
- `audit_logs`
- `match_runs`

Schema migration:

[backend/migrations/001_init.sql](backend/migrations/001_init.sql)

Database documentation and diagrams:

[doc/database-structure.md](doc/database-structure.md)

## GCP Infrastructure

Terraform is available under:

[infra/terraform](infra/terraform)

It enables the required Google Cloud services and creates:

- `carelink-runtime` service account
- runtime IAM bindings
- Artifact Registry Docker repository `carelink-images`

Enabled services include:

- Vertex AI
- Cloud SQL Admin
- Enterprise Knowledge Graph
- Cloud Run
- IAP
- Identity Platform
- Cloud Build
- Artifact Registry
- Cloud Logging
- Cloud Monitoring
- Cloud Trace
- Cloud Tasks

## Local Backend Setup

```powershell
cd backend
cmd /c npm ci
cmd /c npm run dev
```

Then open:

```txt
http://127.0.0.1:8000/health
http://127.0.0.1:8000/openapi.json
```

Run the smoke test:

```powershell
cd backend
cmd /c npm run smoke
```

The smoke test verifies:

- health check
- actor filtering
- case creation
- referral match
- relationship creation
- audit log creation

## Terraform Setup

```powershell
cd infra/terraform
terraform init
terraform plan -var="project_id=YOUR_GCP_PROJECT_ID"
terraform apply -var="project_id=YOUR_GCP_PROJECT_ID"
```

Default region:

```txt
asia-southeast1
```

Do not commit Terraform state files or real `*.tfvars` files.

## Security Model

CareLink is designed to avoid static secrets.

- no API keys in the repo
- no service-account JSON files
- no database passwords committed
- Cloud Run services should run as `carelink-runtime`
- service-to-service authentication should use Application Default Credentials
- deployed end-user auth should use IAP headers

## Hackathon Priorities

For the 24-hour build, the most important backend deliverables are:

1. stable API contract for frontend and agents
2. database schema and migration
3. seeded demo actors and Encik Zainal case
4. compliance gate blocking expired APC
5. relationship audit trail
6. deployed Cloud Run backend
7. no secrets committed

## Known Gaps

Current implementation status:

- backend API scaffold is implemented
- local demo store is in memory
- PostgreSQL schema exists but routes are not yet wired to Cloud SQL persistence
- matching is deterministic demo logic, not real `pgvector` retrieval yet
- ADK agents and frontend are still placeholders
- seed data is smaller than the final 50-actor target

## Project Thesis

The hospital's network is one of its most valuable operational assets. Today, much of that network exists only in the memory of experienced coordinators.

CareLink makes that network programmable: every relationship is created with context, checked for compliance, stored with an audit trail, and improved by outcomes.
