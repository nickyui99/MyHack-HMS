# CareLink ADK — Member 4

Multi-agent chatbot (orchestrator + 5 specialists) that emits A2UI surfaces for the CareLink hospital coordination demo.

## Quick start

```bash
# 1. Authenticate once with ADC (no API keys ever).
gcloud auth application-default login
gcloud config set project my-int-agentspaceent-0425

# 2. Install deps.
cd adk/
cp .env.example .env
make install

# 3. Verify Vertex reachability.
make ping            # expects: pong

# 4. Run the API server.
make serve           # adk api_server on :8000

# 5. Smoke tests.
make smoke
```

## Agents

| Agent | Allowed for persona | Emits A2UI |
|---|---|---|
| `orchestrator` | (all — gates by `persona.allowed_agents`) | greeting / refusal `Card` |
| `referral` | Dr Amirul (GP) | cardiologist candidate cards |
| `team_assembly` | Suri (OR coord) | 4×N team picker grid |
| `allied_health` | Aisha (ward) | 3 specialist cards |
| `compliance` | (auto-invoked guard) | red-banner block |
| `outcome` | Aisha (ward) | outcome form + graph delta |

## Persona sessions

Each browser window pre-creates one ADK session keyed by persona email:

```bash
curl -X POST http://localhost:8000/apps/carelink/users/gp.amirul@carelink.demo/sessions/sess-a1 \
     -H 'Content-Type: application/json' \
     -d @personas/sample_session_amirul.json
```

Then opens SSE on `POST /run_sse` for that `(user_id, session_id)`.

## Backend swap

`backend_stub/data_access.py` is the in-process data layer. Each method carries a `# STUB:HTTP_EQUIVALENT …` marker showing the future REST endpoint. When Member 2's FastAPI is live, swap the bodies to `httpx.get(...)` — signatures stay the same; tools and agents do not change.
