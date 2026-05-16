"""Verify every surface builder produces A2UI v0.9 messages that validate.

Side-effect: writes the validated samples to a2ui_surfaces/examples/ so
A2uiSchemaManager can use them for few-shot grounding in agent prompts.
"""
from __future__ import annotations

import json
import pathlib

import pytest

from a2ui.basic_catalog.provider import BasicCatalog
from a2ui.schema.constants import VERSION_0_9
from a2ui.schema.manager import A2uiSchemaManager
from a2ui.schema.validator import A2uiValidator

from a2ui_surfaces import builders


EXAMPLES_DIR = pathlib.Path(__file__).parent.parent / "a2ui_surfaces" / "examples"
EXAMPLES_DIR.mkdir(parents=True, exist_ok=True)


@pytest.fixture(scope="module")
def validator() -> A2uiValidator:
    mgr = A2uiSchemaManager(version=VERSION_0_9, catalogs=[BasicCatalog.get_config(version=VERSION_0_9)])
    return mgr.get_selected_catalog().validator


def _validate_payload(validator: A2uiValidator, payload: dict, sample_name: str) -> None:
    """Validate each message in payload['messages'] (raises on invalid)."""
    assert "messages" in payload and payload["messages"], payload
    for msg in payload["messages"]:
        validator.validate(msg)  # raises on failure; None on success

    (EXAMPLES_DIR / f"{sample_name}.json").write_text(
        json.dumps(payload["messages"], indent=2), encoding="utf-8"
    )


def test_simple_text_surface(validator: A2uiValidator) -> None:
    payload = builders.build_simple_text_surface("orchestrator", "Hello", "Welcome to CareLink.")
    _validate_payload(validator, payload, "simple_text")


def test_referral_candidates_surface(validator: A2uiValidator) -> None:
    candidates = [
        {"actor_id": "act_aravind", "name": "Dr Aravind Subramaniam", "hospital_name": "Sunway Medical Centre",
         "breakdown_text": "vector 0.62 · rule 1.0 · outcome 0.95", "score": 0.78, "prior_pair_count": 7},
        {"actor_id": "act_tan_cw", "name": "Dr Tan Chee Wei", "hospital_name": "Subang Jaya Medical Centre",
         "breakdown_text": "vector 0.41 · rule 1.0 · outcome 0.89", "score": 0.66, "prior_pair_count": 0},
    ]
    payload = builders.build_referral_candidates_surface(candidates, case_id="case_zainal_2026")
    _validate_payload(validator, payload, "referral_cards")


def test_team_picker_surface(validator: A2uiValidator) -> None:
    roles = {
        "cardiothoracic_surgeon": [{"actor_id": "act_suresh", "name": "Dr Suresh", "score": 0.86, "apc_status_text": "APC valid"}],
        "cardiac_anaesthetist":   [{"actor_id": "act_farah", "name": "Dr Farah", "score": 0.91, "apc_status_text": "APC valid"},
                                    {"actor_id": "act_lim_ws", "name": "Dr Lim", "score": 0.74, "apc_status_text": "⚠ APC expired"}],
        "perfusionist":           [{"actor_id": "act_tan_ek", "name": "Mr Tan EK", "score": 0.88, "apc_status_text": "APC valid"}],
        "or_lead_nurse":          [{"actor_id": "act_mariam", "name": "Mariam BI", "score": 0.85, "apc_status_text": "APC valid"}],
    }
    defaults = {"cardiothoracic_surgeon": "act_suresh", "cardiac_anaesthetist": "act_farah", "perfusionist": "act_tan_ek", "or_lead_nurse": "act_mariam"}
    payload = builders.build_team_picker_surface(roles, case_id="case_zainal_2026", default_picks=defaults)
    _validate_payload(validator, payload, "team_picker")


def test_allied_cards_surface(validator: A2uiValidator) -> None:
    specialists = [
        {"role": "physiotherapist", "actor_id": "act_priya", "name": "Priya Devi", "score": 0.92, "breakdown_text": "vector 0.55 · rule 1.0 · outcome 0.97"},
        {"role": "dietician", "actor_id": "act_meiling", "name": "Chen Mei Ling", "score": 0.88, "breakdown_text": "vector 0.48 · rule 1.0 · outcome 0.94"},
        {"role": "occupational_therapist", "actor_id": "act_hafiz", "name": "Hafiz Bin Rashid", "score": 0.85, "breakdown_text": "vector 0.46 · rule 1.0 · outcome 0.93"},
    ]
    payload = builders.build_allied_cards_surface(specialists, case_id="case_zainal_2026")
    _validate_payload(validator, payload, "allied_cards")


def test_compliance_block_surface(validator: A2uiValidator) -> None:
    failed = [{
        "role": "cardiac_anaesthetist", "actor_id": "act_lim_ws",
        "actor": {"actor_id": "act_lim_ws", "name": "Dr Lim Wei Sheng", "role": "cardiac_anaesthetist"},
        "reasons": ["APC MMC-44290 expired 2026-04-30"],
    }]
    payload = builders.build_compliance_block_surface(failed, case_id="case_zainal_2026")
    _validate_payload(validator, payload, "compliance_block")


def test_outcome_form_surface(validator: A2uiValidator) -> None:
    payload = builders.build_outcome_form_surface(case_id="case_zainal_2026")
    _validate_payload(validator, payload, "outcome_form")


def test_outcome_delta_surface(validator: A2uiValidator) -> None:
    delta = {
        "weight_changes": [
            {"relationship_id": "rel_1", "from": 0.78, "to": 0.80, "delta": 0.02},
            {"relationship_id": "rel_2", "from": 0.86, "to": 0.88, "delta": 0.02},
        ],
        "nodes_added": [{"id": "act_aravind", "name": "Dr Aravind", "role": "cardiologist"}],
        "edges_added": [{"id": "rel_1", "from": "act_amirul", "to": "act_aravind", "type": "referral_chain", "weight": 0.80}],
    }
    payload = builders.build_outcome_delta_surface(delta)
    _validate_payload(validator, payload, "outcome_delta")
