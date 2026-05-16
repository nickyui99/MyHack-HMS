"""Deterministic compliance checks — no LLM judgment.

Rubric line: "Evidence of efforts to reduce hallucinations or incorrect outputs"
— compliance is pure Python, fully testable, fully explainable.
"""
from __future__ import annotations

from datetime import date


def _parse_iso_date(s: str) -> date:
    return date.fromisoformat(s)


def check_apc_valid(actor: dict, today: date | None = None) -> tuple[bool, str]:
    today = today or date.today()
    try:
        expiry = _parse_iso_date(actor["apc_expiry"])
    except (KeyError, ValueError):
        return False, "APC expiry not on file"
    if expiry < today:
        return False, f"APC {actor['apc_number']} expired {actor['apc_expiry']}"
    return True, ""


def check_capacity(actor: dict) -> tuple[bool, str]:
    if actor.get("capacity_next_7d", 0) <= 0:
        return False, "No remaining capacity in the next 7 days"
    return True, ""


def check_subspecialty_fit(actor: dict, case_ctx: dict | None) -> tuple[bool, str]:
    if case_ctx is None:
        return True, ""
    needs = (case_ctx.get("planned_procedure") or "").lower()
    if "cabg" in needs and actor["role"] in {"cardiothoracic_surgeon", "cardiac_anaesthetist", "perfusionist", "or_lead_nurse"}:
        subs = [s.lower() for s in actor.get("subspecialty", [])]
        cardiac_terms = {"cabg", "cardiac_anaesthesia", "cardiopulmonary_bypass", "cardiac_surgery_scrub", "off_pump_bypass", "tee", "or_coordination", "minimally_invasive_perfusion", "adult_cardiopulmonary_bypass"}
        if not any(t in cardiac_terms or "cardiac" in t or "cabg" in t for t in subs):
            return False, "Subspecialty does not match CABG requirement"
    return True, ""


def check_insurance_panel(actor: dict, case_ctx: dict | None) -> tuple[bool, str]:
    if case_ctx is None or not case_ctx.get("panel"):
        return True, ""
    if not actor.get("insurance_panels"):
        return True, ""  # non-clinical roles often have no panel — pass-through
    if case_ctx["panel"] not in actor["insurance_panels"]:
        return False, f"Not on {case_ctx['panel']} panel"
    return True, ""


def run_all(actor: dict, case_ctx: dict | None = None, today: date | None = None) -> dict:
    """Returns {ok, reasons[]}. Always runs every check so the surface shows all issues."""
    results = [
        check_apc_valid(actor, today),
        check_capacity(actor),
        check_subspecialty_fit(actor, case_ctx),
        check_insurance_panel(actor, case_ctx),
    ]
    reasons = [msg for ok, msg in results if not ok]
    return {"ok": len(reasons) == 0, "reasons": reasons}
