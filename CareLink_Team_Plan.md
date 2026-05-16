# CareLink — Team Build Plan
**MyHack 2026 KL · Build With AI · 16–17 May 2026 · Sunway University**

> This is the operational doc. The proposal is in `CareLink_v3_MyHack2026.docx`. Pull this up at hour 0 and don't close the tab.

---

## 0. Mission in one paragraph

We are building **CareLink** — an AI-powered hospital ecosystem coordination platform on Google Cloud, with a multi-agent ADK chatbot (CareLink Copilot) and an Enterprise Knowledge Graph backbone. The patient journey has **three stages**: GP referral → surgical team assembly → allied health coordination, plus an outcome learning loop. We target the **Cradle problem statement** on automating ecosystem linkages. We are competing against ~9 other finalist teams and we want first place.

---

## 1. The Hard Rules — Don't Relitigate These at 2am

These decisions are settled. If someone wants to change them, the cost is hours we don't have.

1. **Stage 4 (post-discharge placement) is out of scope.** It lives in the Year 2 roadmap. Do not add rehab partner code.
2. **Everything runs on Google Cloud. Both frontend and backend on Cloud Run.** No AWS, no Vercel, no Railway. No Firebase Hosting, no Firebase Auth, no Firebase Cloud Messaging.
3. **Database is Cloud SQL for PostgreSQL with the `pgvector` extension.** Not AlloyDB. Not Postgres-on-Compute-Engine. One managed service, one IAM boundary.
4. **No API keys. Application Default Credentials only.** Every service-to-service call uses ADC through a workload service account with least-privilege IAM roles. No `GOOGLE_API_KEY`, no `OPENAI_API_KEY`, no service-account JSON files checked in, no `.env` files with credentials. If a library asks for an API key, you are using it wrong.
5. **End-user auth = Cloud Identity Platform (or IAP).** Identity Platform issues OIDC tokens the backend verifies. Pick IAP if the team prefers a fully Google-managed sign-in with zero auth code on our side.
6. **AI = Gemini 3.1 via Vertex AI.** Not Claude, not OpenAI, not local models. The rubric scores Google tech.
7. **Embeddings = Vertex AI `text-embedding-005`.** Not OpenAI `text-embedding-3-small`.
8. **Chatbot = Google Agent Development Kit (ADK).** Orchestrator + 5 specialist agents. Not a single LLM call wrapped in a chat UI.
9. **Knowledge graph = Google Enterprise Knowledge Graph.** Used for entity reconciliation AND as the relationship-as-entity store.
10. **Hero demo patient = Encik Zainal, 58, NSTEMI → CABG → allied health.** All seed data is built around making his journey land.
11. **Pitch length = 8 min + 7 min Q&A.** Rehearse to 7:30.

---

## 2. Team — Who Owns What

### Member 1 — Frontend & UX Lead

**Owns**
- React + Tailwind UI
- Three matching screens: referral, surgical team, allied health
- Relationship graph visualisation
- Copilot chat panel (sits on the right of every screen)
- Frontend Cloud Run deployment (static React build served by a minimal nginx container)
- Identity Platform / IAP integration on the client

**Files / surfaces**
- `web/` — Vite + React + TS app
- `web/src/screens/Referral.tsx`
- `web/src/screens/SurgicalTeam.tsx`
- `web/src/screens/AlliedHealth.tsx`
- `web/src/screens/Graph.tsx` — D3 / Cytoscape rendering KG edges
- `web/src/components/CopilotPanel.tsx` — streaming chat panel, shows agent tool calls inline
- `web/Dockerfile` — multi-stage build, final stage is `nginx:alpine` serving `/usr/share/nginx/html`
- `web/nginx.conf` — SPA fallback to `index.html`, gzip on
- `web/cloudrun.yaml` (or use `gcloud run deploy` directly)

**Definition of Done**
- Deployed Cloud Run URL serving the static React build
- All 3 screens load real data from the backend
- Chat panel streams Copilot responses (agent name + tool call visible per turn)
- Relationship graph filters by department, actor type, state
- Login works for the 4 roles: GP, coordinator, dept head, ward staff (via Identity Platform or IAP — pick one in hour 0)
- Score-breakdown card visible (vector similarity, rule compliance, outcome weight)

**Hard dependencies**
- Member 2 needs to ship API contract by **hour 4**
- Member 4 needs to ship Copilot SSE endpoint by **hour 14**

---

### Member 2 — Backend & GCP Infrastructure Lead

**Owns**
- Python FastAPI services on Cloud Run
- Cloud SQL for PostgreSQL — schema, migrations, seeding, `pgvector` extension installation
- Relationship entity CRUD + state machine
- Compliance gate business logic
- Cloud Build CI/CD pipeline
- Cloud Logging / Monitoring dashboards
- GCP project, IAM, **runtime service account** (this is the critical one — every Cloud Run service runs as this identity)
- Cloud SQL connectivity via the Cloud SQL Python Connector with `enable_iam_auth=True` — **no database password in code**

**Files / surfaces**
- `api/` — FastAPI app
- `api/models/relationship.py` — the core entity (type, actor_a, actor_b, state, compliance_flags, match_score, outcome_record, case_context)
- `api/models/actor.py` — clinical actor with subspecialty, credentials, APC expiry, capacity
- `api/services/compliance.py` — guard function called before every relationship commit
- `api/db/connector.py` — Cloud SQL connector with IAM auth, **never reads `DB_PASSWORD` env var**
- `api/auth/verifier.py` — verifies Identity Platform OIDC token / trusts IAP JWT header
- `api/routes/relationships.py`, `api/routes/actors.py`, `api/routes/match.py`
- `infra/cloudbuild.yaml`
- `infra/iam-bindings.sh` — script to bind least-privilege roles to the runtime service account

**Definition of Done**
- Cloud SQL instance up, `pgvector` installed, schema migrated, seeded with 50 actors
- All API endpoints live on a Cloud Run URL
- Compliance gate demonstrably blocks an expired-APC match (rehearsed for demo)
- Audit log table populated on every state change
- API contract documented (OpenAPI) so Member 1 + Member 4 aren't blocked
- **Zero secrets in the repo.** `git grep -i 'api_key\|password\|secret'` returns nothing meaningful.

**Hard dependencies**
- Member 3 needs the actor schema finalised by **hour 2** to start the embedding pipeline
- All API contracts locked by **hour 4**

---

### Member 3 — AI Matching & Knowledge Graph Lead

**Owns**
- Vertex AI embedding pipeline (actor profile → vector → Cloud SQL `pgvector` column)
- `pgvector` similarity queries on Cloud SQL
- Google Enterprise Knowledge Graph entity reconciliation job
- Match-score breakdown (vector similarity + rule compliance + outcome weight)
- Outcome feedback weight updates
- Surgical team combination scoring logic
- All Vertex AI and EKG calls authenticate via ADC — the SDKs pick up the Cloud Run service account automatically; **no `credentials=` parameter, no key file**

**Files / surfaces**
- `ml/embeddings.py` — profile → text → Vertex AI embedding (call: `vertexai.init(project=...)` then `TextEmbeddingModel.from_pretrained("text-embedding-005")` — ADC handles auth)
- `ml/retrieval.py` — per-role pgvector retrieval with hard filters
- `ml/team_scoring.py` — combination scoring with historical-pair bonus
- `ml/ekg_reconciliation.py` — runs the EKG entity reconciliation job
- `ml/outcome_weights.py` — writes outcomes back to relationships, updates weights
- `scripts/seed_actors.py` — bulk generate + embed 50 demo actors

**Definition of Done**
- Embedding pipeline runs end-to-end in under 60s for 50 actors
- Per-role pgvector retrieval returns top-N candidates in under 1s
- EKG reconciliation job has run at least once on seed data, output documented
- Score breakdown returned in API response, viewable in the UI
- Team combination scoring has the historical-pair bonus (start simple: +10% if pair has prior shared case)
- Outcome write-back updates weights and is observable in the next match

**Hard dependencies**
- Member 2's actor schema by **hour 2**
- Member 4's Gemini explanation prompt format by **hour 6** (you provide score + actors; they provide narrative)

---

### Member 4 — Agent, Demo & Pitch Lead

**Owns**
- Google Agent Development Kit setup
- Orchestrator agent + 5 specialist agents (Referral, Team Assembly, Allied Health, Compliance, Outcome)
- Gemini 3.1 prompt engineering for clinical explanations (called via Vertex AI with ADC)
- 50 seeded demo actors with realistic Malaysian clinical profiles
- 3 pre-set demo cases with guaranteed-high-score matches
- Demo script (the 8-minute live walkthrough)
- Pitch deck (slides)
- Pitch rehearsal (you facilitate)

**Files / surfaces**
- `agents/` — ADK project
- `agents/orchestrator.py` — root agent, classifies intent, delegates
- `agents/referral_agent.py`
- `agents/team_assembly_agent.py`
- `agents/allied_health_agent.py`
- `agents/compliance_agent.py` — runs as a guard, returns pass/fail with reasons
- `agents/outcome_agent.py`
- `agents/tools/` — each agent's tools call the backend API (carries the user's identity), query the EKG, run Vertex retrieval. All ADC.
- `agents/prompts/` — Gemini system prompts, grounded with KG entity context
- `demo/seed_data.json` — the 50 actors, named for Malaysian context
- `demo/script.md` — the 8-minute narrative with exact prompts to type
- `pitch/slides.pdf`

**Definition of Done**
- ADK skeleton up at hour 1 (start in parallel with infra setup — do not wait)
- All 6 agents respond to a basic prompt by hour 12
- Streaming responses visible in chat (this is what Member 1 wires into CopilotPanel)
- 50 seed actors are clinically credible: Malaysian names, realistic subspecialties, plausible APC numbers, varied outcome histories
- Demo script rehearsed at least 3 times before pitch
- Backup video recorded by hour 23 (in case of venue Wi-Fi failure)

**Hard dependencies**
- Member 2's API endpoints by **hour 8** so agent tools have something to call
- Member 3's retrieval endpoint by **hour 10** so the matching agents work

---

## 3. 24-Hour Timeline with Checkpoints

| Phase | Hours | Everyone | Checkpoint |
|---|---|---|---|
| **Setup** | 0–2 | M1: Vite scaffold + Dockerfile + nginx config. M2: GCP project, enable APIs, **create runtime service account, bind IAM roles, configure Workload Identity, no JSON keys downloaded**. M3: actor schema draft. M4: ADK skeleton + first agent. | **H+2 sync:** actor schema locked, runtime service account exists with correct roles, ADK skeleton runs hello-world. **Verify `git status` is clean of any credential files.** |
| **Core entities** | 2–6 | M1: layout + auth flow (Identity Platform or IAP). M2: Cloud SQL schema, `pgvector` installed, entity CRUD, seed script. M3: embedding pipeline + first EKG reconciliation. M4: 50-actor seed data + prompt templates. | **H+6 sync:** API contract published, retrieval returns results for 1 role. |
| **AI matching** | 6–12 | M1: Referral screen wired to live API. M2: compliance gate. M3: per-role pgvector retrieval + score breakdown. M4: Referral Agent + Team Assembly Agent working. | **H+12 sync:** end-to-end Referral flow works in the UI. **Mandatory checkpoint** — if this slips, cut scope on Stage 3. |
| **Agents + surgical teams** | 12–16 | M1: Surgical Team screen. M2: notifications via Cloud Tasks, audit log. M3: team combination scoring. M4: all 6 agents responding, Compliance Agent integrated. | **H+16 sync:** Surgical Team flow works through the Copilot chat. |
| **Full journey + Copilot** | 16–20 | M1: Allied Health screen + Copilot panel polish. M2: state machine transitions. M3: outcome weight write-back. M4: prompt polish, error handling. | **H+20 sync:** all 3 stages playable. Begin dress rehearsal. |
| **Outcome loop + graph** | 20–22 | M1: graph visualisation. M2: outcome endpoint. M3: live weight updates. M4: pitch deck final draft, first rehearsal. | **H+22 sync:** graph view shows live edges, outcome loop closes. |
| **Polish + demo** | 22–24 | All: dress rehearsal x3, edge case fixes, backup video, submission package (slides PDF, GitHub link, pitch video). | **Submission deadline: 9:00 AM Sunday.** |

---

## 4. Tech Stack Quick Reference

| Layer | Tech | Owner |
|---|---|---|
| Frontend hosting | **Cloud Run** (nginx static container) | M1 |
| Frontend framework | React + Tailwind + Vite | M1 |
| End-user auth | **Cloud Identity Platform** (or IAP in front of Cloud Run) | M1 + M2 |
| Backend API | Python FastAPI on **Cloud Run** | M2 |
| Database | **Cloud SQL for PostgreSQL** + `pgvector` extension | M2 |
| DB connectivity | Cloud SQL Python Connector with **IAM authentication** (`enable_iam_auth=True`) | M2 |
| Service-to-service auth | **Application Default Credentials** via runtime service account — no keys anywhere | M2 (sets up) / everyone (uses) |
| Knowledge graph | **Google Enterprise Knowledge Graph** | M3 |
| Embeddings | **Vertex AI `text-embedding-005`** | M3 |
| Reasoning / explanations | **Gemini 3.1 via Vertex AI** | M3 + M4 |
| Agent orchestration | **Google Agent Development Kit (ADK)** | M4 |
| Vector retrieval | `pgvector` on Cloud SQL | M3 |
| Async notifications (optional) | Cloud Tasks → Cloud Run worker | M2 |
| Observability | Cloud Logging, Cloud Monitoring, Cloud Trace | M2 |
| CI/CD | Cloud Build + Artifact Registry | M2 |

**One-line auth model:** *every Cloud Run service runs as the `carelink-runtime` service account; ADC discovers those credentials automatically; the IAM roles attached to that service account decide what the service can do.*

---

## 5. The 8-Minute Demo Script (M4 owns; rehearse together)

**Pre-flight:** all team members logged in as the right roles, browser zoomed, screens pre-loaded, network checked. Backup video queued in another tab.

| Time | Action | What the judges see |
|---|---|---|
| 0:00–0:45 | **Hook.** "A surgeon needs 4 specialists for a 7am case tomorrow. Today she makes 35 calls. Today we change that." Show the problem statement framing on a slide. | Slide 1 + 2 |
| 0:45–2:00 | **Stage 1 — Referral.** Open Copilot. Type: *"GP Dr Amirul has a 58M with suspected NSTEMI, Prudential BSN panel, in Puchong. Who should we refer to?"* Referral Agent runs, EKG returns reconciled cardiologists, `pgvector` retrieves top matches, Gemini explains. Click to confirm. | Live UI + chat panel + relationship created in graph |
| 2:00–3:45 | **Stage 2 — Surgical Team.** Type: *"Assemble the CABG team for Dr Suresh, 7am tomorrow."* Team Assembly Agent decomposes, Compliance Agent filters, engine scores combinations. **Show the score breakdown card** — this is the moment they see the AI is inspectable. Approve. | 4 relationships created |
| 3:45–4:15 | **The graph.** Switch to graph view. Zainal's subgraph is highlighted, 5 new edges visible, each annotated. **This is the visual hook — pause here for 3 seconds.** | Relationship graph |
| 4:15–5:15 | **Stage 3 — Allied Health.** Type: *"Set up post-CABG allied health for bed 14."* Three matches returned and explained. | 3 relationships created |
| 5:15–6:15 | **Outcome loop.** Two weeks later. Type: *"Log outcome for Encik Zainal: surgical 5/5, no complications. Mobility goals met."* Outcome Agent writes back to all 8 relationships. **Switch to graph view to show weights updating live.** | Weights visibly change |
| 6:15–7:00 | **Compliance + security demo.** Try to assign an expired-APC specialist. Compliance Agent blocks with explanation. Override with justification — logged in the chat. **Bonus line for security points:** "Every one of those agent calls is authenticated through ADC against a service account with least-privilege IAM. No API keys exist in our codebase." | Trust + governance moment |
| 7:00–7:45 | **Business slide.** RM 480K/year saved per hospital. 3× faster team confirmation. Cradle problem statement mapping. | Slide |
| 7:45–8:00 | **Close.** "The hospital's network is its most valuable operational asset. Today it exists only in coordinators' memory. CareLink makes it programmable." | Slide |

---

## 6. Sync Cadence

- **Every 2 hours**: 5-min standup. What's done, what's blocked, what's next. No exceptions.
- **Hour 12**: half-time honest review. If Stage 3 backend is at risk, cut it — show Stage 3 through Copilot only.
- **Hour 20**: dress rehearsal 1. Time it.
- **Hour 22**: dress rehearsal 2. Time it. Record backup video.
- **Hour 23**: dress rehearsal 3 if Wi-Fi at venue is questionable.

Use a Discord voice channel left open. Not text — voice is faster at 2am.

---

## 7. Risk Triggers — What To Do When

| Trigger | Action |
|---|---|
| **H+4: API contract not done** | M2 stops everything else. Contract is the unblock. |
| **H+4: IAM roles not bound, ADC not working** | M2 stops. Until ADC works locally and on Cloud Run, nothing else runs. Use `gcloud auth application-default login` for local dev; on Cloud Run it just works via the service account. |
| **H+8: ADK agents not responding** | M4 falls back to a single Gemini-via-Vertex chat call wrapping the matching API. Re-attempt full ADK if time permits. Demo still works. |
| **H+12: Referral flow not end-to-end** | Cut Stage 3 entirely from the demo. Show it as a roadmap slide. Stage 1 + Stage 2 + Copilot + graph is still a winning demo. |
| **H+12: EKG reconciliation slow / broken** | Pre-run reconciliation once on seed data, hard-code the canonical entity map. The talking point about EKG stays valid. |
| **H+12: Cloud SQL connector + IAM auth not working** | Fall back to private IP + Cloud SQL Auth Proxy sidecar pattern. Still no password in app code; still IAM-gated. |
| **H+16: Surgical team combination scoring too complex** | Simplify: individual matching + historical-pair bonus only. Document the full algorithm in the pitch as "next iteration". |
| **H+20: Outcome loop weights not updating live** | Pre-record a 20-second clip of weights updating. Play it during the demo at the outcome moment. Honest about it in Q&A if asked. |
| **Venue Wi-Fi flaky** | Use the backup recording. Practice the narration over the recording. |

---

## 8. GCP Pre-Flight Checklist (M2, do this before hour 0 if possible)

- [ ] GCP project created with billing enabled (check free credits / Google sponsorship)
- [ ] **Enable APIs:** `aiplatform.googleapis.com`, `sqladmin.googleapis.com`, `enterpriseknowledgegraph.googleapis.com`, `run.googleapis.com`, `iap.googleapis.com`, `identitytoolkit.googleapis.com` (Identity Platform), `cloudbuild.googleapis.com`, `artifactregistry.googleapis.com`, `logging.googleapis.com`, `cloudtasks.googleapis.com`
- [ ] **Runtime service account** `carelink-runtime@<project>.iam.gserviceaccount.com` with roles:
  - `roles/aiplatform.user` (Vertex AI: Gemini, embeddings)
  - `roles/cloudsql.client` (Cloud SQL connection)
  - `roles/cloudsql.instanceUser` (for IAM database auth)
  - `roles/enterpriseknowledgegraph.admin` (EKG reconciliation jobs)
  - `roles/run.invoker` (service-to-service Cloud Run calls)
  - `roles/cloudtrace.agent`, `roles/logging.logWriter`, `roles/monitoring.metricWriter`
- [ ] **No service-account JSON key downloaded.** All authentication via Workload Identity / ADC.
- [ ] Cloud SQL for PostgreSQL instance in `asia-southeast1` (closest to Malaysia), Enterprise edition
- [ ] `pgvector` extension installed on the Cloud SQL instance (`CREATE EXTENSION vector;`)
- [ ] IAM database authentication enabled on Cloud SQL
- [ ] Database user `carelink-runtime@<project>.iam` created and granted on the schema
- [ ] Artifact Registry repo `carelink-images` created in `asia-southeast1`
- [ ] **Identity Platform** initialised, sign-in providers enabled (Email/Password + Google) **OR** **IAP** enabled in front of the planned Cloud Run services
- [ ] IAP audiences / Identity Platform tenant IDs noted for backend token validation
- [ ] Domain decided (Cloud Run-generated URL is fine for the hackathon; load balancer + custom domain optional)
- [ ] `gcloud` CLI logged in on every team member's laptop with `gcloud auth application-default login` (so local dev uses ADC against the cloud services)

---

## 9. Working Agreements

1. **No new dependencies after hour 16.** New libraries break things. Use what you have.
2. **No new features after hour 20.** Polish, fix, rehearse only.
3. **No secrets in git, ever.** Pre-commit hook + `git grep` check at every standup. The auth story is part of our pitch — we can't have a service-account JSON in the repo.
4. **Commit every hour minimum.** GitHub is our backup.
5. **One main branch.** No long-lived feature branches. Small commits, frequent merges.
6. **If you're stuck for 20 minutes, ask.** Don't burn an hour alone.
7. **Sleep in shifts.** Two people awake at all times between 2am and 6am.
8. **Eat.** Coffee is not food.
9. **Be honest in standups.** "I'm at 60%" is more useful than "I'm fine".

---

## 10. Resources

- **Cradle problem statement** — the source of truth for what we're solving
- **Final Rubrics PDF** — read it again at hour 12 and again at hour 20
- **Participants Handbook** — submission requirements, timing, venue
- **Enterprise Knowledge Graph docs**: https://docs.cloud.google.com/enterprise-knowledge-graph/docs/overview
- **Google ADK docs**: search for the latest before starting (M4)
- **Vertex AI Gemini docs**: model name and quota check before starting (M3)
- **Cloud SQL + pgvector**: https://cloud.google.com/sql/docs/postgres/extensions
- **Cloud SQL IAM auth**: https://cloud.google.com/sql/docs/postgres/iam-authentication
- **Cloud Run authentication**: ADC via attached service account — the SDK story
- **Identity Platform**: https://cloud.google.com/identity-platform
- **IAP for Cloud Run**: https://cloud.google.com/iap/docs/enabling-cloud-run
- **Proposal docx**: `CareLink_v3_MyHack2026.docx` — the source for every "why" question

---

## 11. Submission Package (M4 ensures all of this is in by 9:00 AM Sunday)

- [ ] **Presentation slides (PDF)** — pitch deck
- [ ] **Pitching video** — backup recording of the demo + UN SDG impact framing
- [ ] **GitHub repo link** — public, README has setup steps + architecture diagram, **zero secrets committed**
- [ ] **Questionnaire answers**:
  - Elevator pitch
  - Google technologies used + justification (the 8 services)
  - AI components + models + ethical considerations (mention ADC + IAM as part of the responsible deployment story)
  - Tech stack + deployment + AI performance
  - Targeted issue + how we manage it differently + measurable improvements
  - Core features + stakeholders + beneficiaries
  - Business model + revenue + scalability
  - Current infrastructure + path to production

---

**Last thought.** The Sunway teams will out-iterate us on UI polish if we let them. Our edge is the *thesis* — relationships as first-class entities in a knowledge graph, orchestrated by a multi-agent system, learning from outcomes — backed by a clean, secrets-free, IAM-governed deployment. Every demo moment should reinforce that thesis. If a feature doesn't, cut it.

Let's win this.
