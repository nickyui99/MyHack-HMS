"""Pinned model env for deterministic smoke tests.

Must run before any `agents.carelink` import — module-level config reads
`CARELINK_*` env vars at import time. Pytest auto-collects conftest before
tests, so this is the safest place.
"""
import os

# Force known-good Vertex models for the smoke suite. Production / live demo
# can override via .env if a different model is desired.
os.environ.setdefault("CARELINK_SPECIALIST_MODEL", "gemini-flash-latest")
os.environ.setdefault("CARELINK_ORCHESTRATOR_MODEL", "gemini-flash-latest")
