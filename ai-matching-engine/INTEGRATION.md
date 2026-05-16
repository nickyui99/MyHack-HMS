# Match Service — Integration Guide for Member 2

## What this service does

This is a Python FastAPI service that exposes real AI-powered match endpoints.
It replaces the hardcoded `deterministic_demo: true` logic in `match.js`.

Endpoints:
- `POST /match/referral`
- `POST /match/surgical-team`
- `POST /match/allied-health`
- `GET  /health`

---

## Deploying to Cloud Run (Member 3 does this)

```bash
cd ai-matching-engine

gcloud run deploy carelink-match-service \
  --source . \
  --region asia-southeast1 \
  --service-account carelink-runtime@PROJECT_ID.iam.gserviceaccount.com \
  --set-env-vars GCP_PROJECT=PROJECT_ID,GCP_REGION=asia-southeast1,CLOUD_SQL_CONN=PROJECT_ID:asia-southeast1:carelink-db,DB_NAME=carelink,DB_USER=carelink-runtime@PROJECT_ID.iam \
  --add-cloudsql-instances PROJECT_ID:asia-southeast1:carelink-db \
  --no-allow-unauthenticated
```

This gives you a URL like:
`https://carelink-match-service-xxxxxxxxxx-as.a.run.app`

---

## Wiring into match.js (Member 2 does this)

Add this env var to the backend Cloud Run service:
```
MATCH_SERVICE_URL=https://carelink-match-service-xxxxxxxxxx-as.a.run.app
```

Then replace the body of `runMatch()` in `backend/src/routes/match.js`:

```js
async function runMatch(matchType, payload, userEmail) {
  if (!store.cases.has(payload.case_id)) {
    const error = new Error("Case not found");
    error.statusCode = 404;
    throw error;
  }

  // Build case context from the case record
  const caseRecord = store.cases.get(payload.case_id);
  const caseCtx = {
    case_id:          payload.case_id,
    diagnosis:        caseRecord.diagnosis,
    payer:            caseRecord.payer,
    location:         caseRecord.location,
    procedure:        caseRecord.clinical_context?.procedure,
    clinical_context: caseRecord.clinical_context,
  };

  // Call the Python match service
  const endpoint = `${process.env.MATCH_SERVICE_URL}/match/${matchType.replace("_", "-")}`;
  const response = await fetch(endpoint, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ case_ctx: caseCtx, top_n: 3 }),
  });

  if (!response.ok) {
    const err = new Error(`Match service error: ${response.status}`);
    err.statusCode = 502;
    throw err;
  }

  const matchResult = await response.json();

  // Create relationships if requested (same as before)
  const relationshipIds = [];
  if (payload.create_relationships && payload.requested_by_actor_id) {
    const actorIds = matchResult.top_actor_ids
      || Object.values(matchResult.recommended_team || {}).map(a => a.id)
      || [];
    for (const actorId of actorIds) {
      const relationship = createRelationship({
        case_id:           payload.case_id,
        relationship_type: relationshipType(matchType),
        actor_a_id:        payload.requested_by_actor_id,
        actor_b_id:        actorId,
        match_score:       matchResult.candidates?.[0]?.score * 100 || 80,
        score_breakdown:   matchResult.score_breakdown || matchResult.team_score || {},
        case_context:      payload.context || {},
      }, userEmail);
      relationshipIds.push(relationship.id);
    }
  }

  return {
    ...matchResult,
    recommended_relationship_ids: relationshipIds,
  };
}
```

---

## Fallback: if the match service is down

Keep the original deterministic logic as a fallback:

```js
async function runMatch(matchType, payload, userEmail) {
  if (process.env.MATCH_SERVICE_URL) {
    try {
      return await runMatchAI(matchType, payload, userEmail);
    } catch (err) {
      console.warn("Match service unavailable, falling back to demo logic:", err.message);
    }
  }
  return runMatchDemo(matchType, payload, userEmail); // original function, renamed
}
```

---

## Local testing

Start the match service locally:
```bash
cd ai-matching-engine
uvicorn main:app --reload --port 8001
```

Then set in backend/.env:
```
MATCH_SERVICE_URL=http://localhost:8001
```

Test it:
```bash
curl -X POST http://localhost:8001/match/referral \
  -H "Content-Type: application/json" \
  -d '{"case_ctx": {"diagnosis": "NSTEMI", "payer": "Prudential BSN", "location": "Puchong"}}'
```
