"""Backend interface — both the in-process stub and Member 2's future FastAPI satisfy this.

When the HTTP backend lands, write an `HttpBackend(BackendInterface)` impl in
`http_backend.py`, change one line in `data_access.py` to swap `StubBackend()`
for `HttpBackend(base_url=...)`. Tools and agents do not change.
"""
from __future__ import annotations

from typing import Protocol


class BackendInterface(Protocol):
    """Every method returns JSON-serialisable dicts shaped like a future FastAPI response."""

    def find_actors_by_role(self, role: str, filters: dict | None = None) -> list[dict]: ...

    def get_actor(self, actor_id: str) -> dict | None: ...

    def get_case(self, case_id: str) -> dict | None: ...

    def compute_match_score(self, case_ctx: dict, actor_id: str) -> dict:
        """Returns {score, vector, rule, outcome, breakdown_text}."""
        ...

    def compute_team_score(self, case_ctx: dict, picks: dict[str, str]) -> dict:
        """picks = {role: actor_id}. Returns {team_score, per_role_scores, pair_bonus}."""
        ...

    def check_compliance(self, actor_id: str, case_ctx: dict | None = None) -> dict:
        """Returns {ok, reasons[], actor}."""
        ...

    def validate_team(self, picks: dict[str, str], case_ctx: dict | None = None) -> dict:
        """Returns {ok, failed: [{role, actor_id, reasons}], passed: [{role, actor_id}]}."""
        ...

    def create_relationship(self, type_: str, actor_a: str, actor_b: str, case_ctx: dict) -> dict: ...

    def record_outcome(self, case_id: str, scores: dict, notes: str = "") -> dict: ...

    def update_relationship_weights(self, case_id: str) -> dict: ...

    def get_team_history(self, actor_a: str, actor_b: str) -> dict:
        """Returns {prior_case_count, success_rate}."""
        ...

    def get_graph_delta(self, case_id: str, since: str | None = None) -> dict:
        """Returns {nodes_added, edges_added, weight_changes}."""
        ...
