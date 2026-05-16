"""Verify the in-process backend, especially the demo's booby-trap (expired APC)."""
from __future__ import annotations

from datetime import date

import pytest

from backend_stub import compliance_rules
from backend_stub.data_access import StubBackend
from backend_stub.store import InMemoryStore


@pytest.fixture
def backend() -> StubBackend:
    # Fresh store per test to avoid cross-test relationship pollution.
    return StubBackend(store=InMemoryStore())


def test_seed_loads(backend: StubBackend) -> None:
    assert len(backend.store.actors) >= 10
    assert backend.get_actor("act_suresh") is not None
    assert backend.get_actor("act_lim_ws") is not None
    assert backend.get_case("case_zainal_2026") is not None


def test_find_actors_by_role(backend: StubBackend) -> None:
    cardios = backend.find_actors_by_role("cardiologist")
    names = {a["name"] for a in cardios}
    assert "Dr Aravind Subramaniam" in names
    assert "Dr Tan Chee Wei" in names


def test_find_actors_filtered_by_panel(backend: StubBackend) -> None:
    prudential_cardios = backend.find_actors_by_role("cardiologist", {"panel": "Prudential"})
    names = {a["name"] for a in prudential_cardios}
    assert "Dr Aravind Subramaniam" in names  # on Prudential
    assert "Dr Tan Chee Wei" in names  # on Prudential


def test_match_score_ranks_aravind_first(backend: StubBackend) -> None:
    case = backend.get_case("case_zainal_2026")
    a = backend.compute_match_score(case, "act_aravind")
    t = backend.compute_match_score(case, "act_tan_cw")
    assert a["score"] > t["score"], f"Expected Aravind > Tan CW. Got {a} vs {t}"


def test_compliance_lim_expired_apc(backend: StubBackend) -> None:
    """The demo booby-trap. Dr Lim's APC expired 2026-04-30; today is 2026-05-16."""
    verdict = backend.check_compliance("act_lim_ws", backend.get_case("case_zainal_2026"))
    assert verdict["ok"] is False
    assert any("APC" in r and "expired" in r for r in verdict["reasons"]), verdict


def test_compliance_farah_passes(backend: StubBackend) -> None:
    verdict = backend.check_compliance("act_farah", backend.get_case("case_zainal_2026"))
    assert verdict["ok"] is True, verdict


def test_validate_team_blocks_lim(backend: StubBackend) -> None:
    case = backend.get_case("case_zainal_2026")
    picks = {
        "cardiothoracic_surgeon": "act_suresh",
        "cardiac_anaesthetist": "act_lim_ws",  # the trap
        "perfusionist": "act_tan_ek",
        "or_lead_nurse": "act_mariam",
    }
    out = backend.validate_team(picks, case)
    assert out["ok"] is False
    failed_actors = {f["actor_id"] for f in out["failed"]}
    assert failed_actors == {"act_lim_ws"}, out


def test_validate_team_clean(backend: StubBackend) -> None:
    case = backend.get_case("case_zainal_2026")
    picks = {
        "cardiothoracic_surgeon": "act_suresh",
        "cardiac_anaesthetist": "act_farah",
        "perfusionist": "act_tan_ek",
        "or_lead_nurse": "act_mariam",
    }
    out = backend.validate_team(picks, case)
    assert out["ok"] is True, out
    assert len(out["passed"]) == 4


def test_team_score_includes_pair_bonus(backend: StubBackend) -> None:
    case = backend.get_case("case_zainal_2026")
    # Suresh has prior_pair_partners = [farah, mariam, tan_ek] => 3 pairs.
    picks = {
        "cardiothoracic_surgeon": "act_suresh",
        "cardiac_anaesthetist": "act_farah",
        "perfusionist": "act_tan_ek",
        "or_lead_nurse": "act_mariam",
    }
    out = backend.compute_team_score(case, picks)
    assert out["documented_prior_pairs"] >= 3, out
    assert out["pair_bonus"] >= 0.30, out


def test_create_relationship_and_graph_delta(backend: StubBackend) -> None:
    case = backend.get_case("case_zainal_2026")
    rel = backend.create_relationship("referral_chain", "act_amirul", "act_aravind", case)
    assert rel["case_id"] == "case_zainal_2026"
    delta = backend.get_graph_delta("case_zainal_2026")
    assert any(e["from"] == "act_amirul" and e["to"] == "act_aravind" for e in delta["edges_added"])


def test_record_outcome_updates_weights(backend: StubBackend) -> None:
    case = backend.get_case("case_zainal_2026")
    rel = backend.create_relationship("referral_chain", "act_amirul", "act_aravind", case)
    backend.record_outcome("case_zainal_2026", {"surgical_score": 5, "complications": 0, "mobility_goal_met": True})
    out = backend.update_relationship_weights("case_zainal_2026")
    bumps = [b for b in out["weight_changes"] if b["relationship_id"] == rel["relationship_id"]]
    assert bumps and bumps[0]["delta"] == 0.02


def test_apc_check_units() -> None:
    actor_expired = {"apc_number": "X", "apc_expiry": "2026-04-30"}
    actor_valid = {"apc_number": "Y", "apc_expiry": "2027-01-01"}
    today = date(2026, 5, 16)
    assert compliance_rules.check_apc_valid(actor_expired, today)[0] is False
    assert compliance_rules.check_apc_valid(actor_valid, today)[0] is True
