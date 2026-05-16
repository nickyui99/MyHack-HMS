# `backend_stub/` — in-process data layer

Every Cloud-SQL-backed FastAPI endpoint Member 2 will eventually expose has an in-process equivalent here. Agents and tools depend on `BackendInterface`; the stub is just one implementation of it.

## Swap to real backend

When Member 2's FastAPI is on Cloud Run:

1. Add `http_backend.py` next to `data_access.py` with `class HttpBackend(BackendInterface)` calling `httpx.get(...)` per method.
2. Change one line in `data_access.py`:
   ```python
   backend: BackendInterface = HttpBackend(base_url=os.environ["CARELINK_API_URL"])
   ```
3. Tools and agents are unchanged.

## Endpoint hints

Every method in `data_access.py` carries a `# STUB:HTTP_EQUIVALENT …` comment with the expected REST path and method. Use those as the contract.

## Why deterministic compliance and matching

Compliance (`compliance_rules.py`) and matching (`matching.py`) are intentionally pure Python — no LLM judgment. Hallucination mitigation per the rubric line "Evidence of efforts to reduce hallucinations or incorrect outputs".

Real `text-embedding-005` similarity ships with Member 3's pipeline; replace `_token_similarity` in `matching.py` only — signatures stay the same.
