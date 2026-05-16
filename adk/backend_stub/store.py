"""In-memory store wrapping the seed JSON files."""
from __future__ import annotations

import pathlib
import threading
import uuid
from datetime import datetime, timezone

import orjson

SEED_DIR = pathlib.Path(__file__).parent / "seed"


def _load(name: str) -> list[dict]:
    return orjson.loads((SEED_DIR / name).read_bytes())


class InMemoryStore:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self.actors: dict[str, dict] = {a["actor_id"]: a for a in _load("actors.json")}
        self.cases: dict[str, dict] = {c["case_id"]: c for c in _load("cases.json")}
        self.relationships: dict[str, dict] = {r["relationship_id"]: r for r in _load("relationships.json")}

    def actor(self, actor_id: str) -> dict | None:
        return self.actors.get(actor_id)

    def actors_by_role(self, role: str) -> list[dict]:
        return [a for a in self.actors.values() if a.get("role") == role]

    def case(self, case_id: str) -> dict | None:
        return self.cases.get(case_id)

    def add_relationship(
        self,
        type_: str,
        actor_a: str,
        actor_b: str,
        case_id: str | None,
        match_score: float,
        compliance_flags: list[str] | None = None,
    ) -> dict:
        with self._lock:
            rid = f"rel_{uuid.uuid4().hex[:10]}"
            rel = {
                "relationship_id": rid,
                "type": type_,
                "actor_a": actor_a,
                "actor_b": actor_b,
                "state": "active",
                "case_id": case_id,
                "compliance_flags": compliance_flags or [],
                "match_score": match_score,
                "outcome_record": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            self.relationships[rid] = rel
            return rel

    def relationships_for_case(self, case_id: str) -> list[dict]:
        return [r for r in self.relationships.values() if r.get("case_id") == case_id]

    def historical_pair(self, actor_a: str, actor_b: str) -> dict | None:
        for r in self.relationships.values():
            pair = {r["actor_a"], r["actor_b"]}
            if pair == {actor_a, actor_b} and r["state"] == "historical":
                return r
        return None


_store: InMemoryStore | None = None


def get_store() -> InMemoryStore:
    global _store
    if _store is None:
        _store = InMemoryStore()
    return _store
