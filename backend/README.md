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

Local mode accepts requests without IAP and uses an in-memory seeded store for fast team integration.

## Cloud SQL

The production schema is in `migrations/001_init.sql`. Use Cloud SQL IAM database auth in deployment. Do not add DB passwords or service-account JSON files.

## Database scripts

Run the schema first, then demo seed data:

```powershell
psql "YOUR_POSTGRES_CONNECTION_STRING" -f migrations/001_init.sql
psql "YOUR_POSTGRES_CONNECTION_STRING" -f migrations/002_seed_demo.sql
psql "YOUR_POSTGRES_CONNECTION_STRING" -f migrations/verify_demo.sql
```

`002_seed_demo.sql` inserts:

- 50 Malaysian-context demo actors
- Encik Zainal hero case
- two additional demo cases
- referral, CABG team, allied health, and expired-APC blocked relationships
- match run records with score breakdowns
- audit log events for governance/demo proof
