"""In-process stub backend for CareLink ADK.

Provides the same surface area as Member 2's future FastAPI on Cloud Run.
Swap point: `data_access.backend` — every method carries a STUB:HTTP_EQUIVALENT
marker showing the future REST endpoint.
"""
from backend_stub.data_access import backend

__all__ = ["backend"]
