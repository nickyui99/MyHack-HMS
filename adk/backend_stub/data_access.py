"""In-process implementation of BackendInterface.

Every method begins with a STUB:HTTP_EQUIVALENT marker indicating the future
FastAPI endpoint. When Member 2 ships, replace the body with `httpx.get(...)`.
Tool and agent code is untouched.
"""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from backend_stub import compliance_rules, matching
from backend_stub.interface import BackendInterface
from backend_stub.store import InMemoryStore, get_store


class StubBackend(BackendInterface):
    def __init__(self, store: InMemoryStore | None = None) -> None:
        self.store = store or get_store()

    # STUB:HTTP_EQUIVALENT GET /api/v1/actors?role={role}
    def find_actors_by_role(self, role: str, filters: dict | None = None) -> list[dict]:
        out = self.store.actors_by_role(role)
        if filters:
            panel = filters.get("panel")
            city = filters.get("city")
            hospital_id = filters.get("hospital_id")
            if panel:
                out = [a for a in out if not a.get("insurance_panels") or panel in a["insurance_panels"]]
            if city:
                out = [a for a in out if a.get("city") == city]
            if hospital_id:
                out = [a for a in out if a.get("hospital_id") == hospital_id]
        return out

    # STUB:HTTP_EQUIVALENT GET /api/v1/actors/{actor_id}
    def get_actor(self, actor_id: str) -> dict | None:
        return self.store.actor(actor_id)

    # STUB:HTTP_EQUIVALENT GET /api/v1/cases/{case_id}
    def get_case(self, case_id: str) -> dict | None:
        return self.store.case(case_id)

    # STUB:HTTP_EQUIVALENT POST /api/v1/match/score  (body: case_ctx + actor_id)
    def compute_match_score(self, case_ctx: dict, actor_id: str) -> dict:
        actor = self.store.actor(actor_id)
        if actor is None:
            return {"score": 0.0, "vector": 0.0, "rule": 0.0, "outcome": 0.0, "breakdown_text": "actor not found"}
        return matching.compute_match_score(case_ctx, actor)

    # STUB:HTTP_EQUIVALENT POST /api/v1/match/team  (body: case_ctx + picks)
    def compute_team_score(self, case_ctx: dict, picks: dict[str, str]) -> dict:
        picks_with_actors = {role: self.store.actor(aid) for role, aid in picks.items() if self.store.actor(aid)}
        return matching.compute_team_score(case_ctx, picks_with_actors)

    # STUB:HTTP_EQUIVALENT POST /api/v1/compliance/actor  (body: actor_id, case_ctx)
    def check_compliance(self, actor_id: str, case_ctx: dict | None = None) -> dict:
        actor = self.store.actor(actor_id)
        if actor is None:
            return {"ok": False, "reasons": ["Actor not found"], "actor": None}
        result = compliance_rules.run_all(actor, case_ctx)
        return {**result, "actor": {"actor_id": actor["actor_id"], "name": actor["name"], "role": actor["role"]}}

    # STUB:HTTP_EQUIVALENT POST /api/v1/compliance/team  (body: picks, case_ctx)
    def validate_team(self, picks: dict[str, str], case_ctx: dict | None = None) -> dict:
        failed: list[dict] = []
        passed: list[dict] = []
        for role, actor_id in picks.items():
            verdict = self.check_compliance(actor_id, case_ctx)
            entry = {"role": role, "actor_id": actor_id, "actor": verdict["actor"], "reasons": verdict["reasons"]}
            (passed if verdict["ok"] else failed).append(entry)
        return {"ok": len(failed) == 0, "failed": failed, "passed": passed}

    # STUB:HTTP_EQUIVALENT POST /api/v1/relationships  (body: type, actor_a, actor_b, case_ctx)
    def create_relationship(self, type_: str, actor_a: str, actor_b: str, case_ctx: dict) -> dict:
        score = self.compute_match_score(case_ctx, actor_b).get("score", 0.0)
        rel = self.store.add_relationship(
            type_=type_, actor_a=actor_a, actor_b=actor_b,
            case_id=case_ctx.get("case_id"), match_score=score,
        )
        return rel

    # STUB:HTTP_EQUIVALENT POST /api/v1/cases/{case_id}/outcome  (body: scores, notes)
    def record_outcome(self, case_id: str, scores: dict, notes: str = "") -> dict:
        updated = 0
        for rel in self.store.relationships_for_case(case_id):
            rel["outcome_record"] = {**scores, "notes": notes, "recorded_at": datetime.now(timezone.utc).isoformat()}
            updated += 1
        return {"case_id": case_id, "relationships_updated": updated}

    # STUB:HTTP_EQUIVALENT POST /api/v1/cases/{case_id}/weights/recompute
    def update_relationship_weights(self, case_id: str) -> dict:
        bumps: list[dict] = []
        for rel in self.store.relationships_for_case(case_id):
            outcome = rel.get("outcome_record") or {}
            bump = 0.02 if outcome.get("complications", 0) == 0 else -0.01
            new_score = round(min(1.0, max(0.0, rel["match_score"] + bump)), 3)
            bumps.append({"relationship_id": rel["relationship_id"], "from": rel["match_score"], "to": new_score, "delta": bump})
            rel["match_score"] = new_score
        return {"case_id": case_id, "weight_changes": bumps}

    # STUB:HTTP_EQUIVALENT GET /api/v1/pairs/{actor_a}/{actor_b}/history
    def get_team_history(self, actor_a: str, actor_b: str) -> dict:
        h = self.store.historical_pair(actor_a, actor_b)
        if h is None:
            return {"prior_case_count": 0, "success_rate": 0.0}
        rec = h.get("outcome_record") or {}
        return {"prior_case_count": rec.get("prior_case_count", 0), "success_rate": rec.get("success_rate", 0.0)}

    # STUB:HTTP_EQUIVALENT GET /api/v1/cases/{case_id}/graph_delta?since=...
    def get_graph_delta(self, case_id: str, since: str | None = None) -> dict:
        rels = self.store.relationships_for_case(case_id)
        nodes = sorted({rel["actor_a"] for rel in rels} | {rel["actor_b"] for rel in rels})
        node_objs: list[dict] = []
        for nid in nodes:
            actor = self.store.actor(nid)
            if actor:
                node_objs.append({"id": nid, "name": actor["name"], "role": actor["role"]})
        edges = [
            {"id": r["relationship_id"], "from": r["actor_a"], "to": r["actor_b"], "type": r["type"], "weight": r["match_score"]}
            for r in rels
        ]
        return {"nodes_added": node_objs, "edges_added": edges, "weight_changes": []}


backend: BackendInterface = StubBackend()
