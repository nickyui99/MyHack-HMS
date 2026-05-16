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
