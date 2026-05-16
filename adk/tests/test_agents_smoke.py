"""End-to-end smoke test: each specialist responds via real Vertex Gemini.

Requires:
    - `gcloud auth application-default login`
    - env: GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION=global, GOOGLE_GENAI_USE_VERTEXAI=TRUE

Run with:  uv run pytest tests/test_agents_smoke.py -v
Skipped automatically when ADC + Vertex are not reachable.
"""
from __future__ import annotations

import asyncio
import json
import os
import re

import pytest
from google.adk.runners import InMemoryRunner
from google.genai.types import Content, Part

from agents.carelink import root_agent


APP_NAME = "carelink"
A2UI_BLOCK_RE = re.compile(r"<a2ui-json>(.*?)</a2ui-json>", re.DOTALL)


def _adc_available() -> bool:
    """Quick reachability check — skip the suite if Vertex won't answer."""
    if not os.environ.get("GOOGLE_CLOUD_PROJECT"):
        return False
    try:
        from google import genai
        c = genai.Client(vertexai=True)
        c.models.generate_content(model="gemini-flash-latest", contents="ok")
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _adc_available(), reason="ADC + Vertex unavailable; export env + gcloud login")


PERSONAS = {
    "gp.amirul@carelink.demo": {"display_name": "Dr Amirul Hassan", "role": "general_practitioner", "allowed_agents": ["referral"]},
    "coord.suri@carelink.demo": {"display_name": "Suri Wong", "role": "or_coordinator", "allowed_agents": ["team_assembly"]},
    "ward.aisha@carelink.demo": {"display_name": "Nurse Aisha", "role": "ward_nurse", "allowed_agents": ["allied_health", "outcome"]},
}

ZAINAL_CTX = {"case_id": "case_zainal_2026", "patient_pseudonym": "Encik Zainal", "panel": "Prudential"}


async def _run_one(user_id: str, prompt: str) -> tuple[str, list[dict]]:
    """Run one turn, return (full_text_concatenated, list_of_parsed_a2ui_messages)."""
    runner = InMemoryRunner(agent=root_agent, app_name=APP_NAME)
    session_id = f"sess-{user_id.split('@')[0]}-{os.urandom(2).hex()}"
    persona = PERSONAS[user_id]
    runner.session_service.create_session_sync(
        app_name=APP_NAME, user_id=user_id, session_id=session_id,
        state={"persona": persona, "case_ctx": ZAINAL_CTX, "active_surface_map": {}},
    )
    text_buf: list[str] = []
    async for event in runner.run_async(
        user_id=user_id, session_id=session_id,
        new_message=Content(role="user", parts=[Part(text=prompt)]),
    ):
        if event.content and event.content.parts:
            for p in event.content.parts:
                if getattr(p, "text", None):
                    text_buf.append(p.text)
    full = "\n".join(text_buf)
    a2ui_blocks: list[dict] = []
    for match in A2UI_BLOCK_RE.findall(full):
        try:
            a2ui_blocks.append(json.loads(match))
        except json.JSONDecodeError:
            pass
    await runner.close()
    return full, a2ui_blocks


def _assert_a2ui_present(full: str, blocks: list[dict]) -> None:
    assert "<a2ui-json>" in full, f"No A2UI block in agent reply:\n{full[:600]}"
    assert blocks, f"A2UI block present but failed to parse JSON. Reply:\n{full[:600]}"
    # Each block should be either a single message dict or a list of messages.
    messages = blocks[0] if isinstance(blocks[0], list) else [blocks[0]]
    assert any("createSurface" in m or "updateComponents" in m or "updateDataModel" in m for m in messages), \
        f"A2UI block has no known message type: {messages[:2]}"


@pytest.mark.asyncio
async def test_referral_finds_candidates() -> None:
    full, blocks = await _run_one(
        "gp.amirul@carelink.demo",
        "I have a 58 year old male with suspected NSTEMI on Prudential panel in Puchong. Find me a cardiologist for case_zainal_2026.",
    )
    _assert_a2ui_present(full, blocks)
    assert "aravind" in full.lower() or "act_aravind" in full.lower(), f"Expected Aravind in reply:\n{full[:800]}"


@pytest.mark.asyncio
async def test_team_assembly_picker() -> None:
    full, blocks = await _run_one(
        "coord.suri@carelink.demo",
        "Assemble the CABG team for case_zainal_2026, OR-2 at 7am tomorrow.",
    )
    _assert_a2ui_present(full, blocks)


@pytest.mark.asyncio
async def test_team_assembly_compliance_interrupt() -> None:
    """Booby-trap: lock a team that includes Dr Lim (expired APC). Expect compliance block."""
    full, blocks = await _run_one(
        "coord.suri@carelink.demo",
        ("Lock this team for case_zainal_2026: "
         "cardiothoracic_surgeon=act_suresh, cardiac_anaesthetist=act_lim_ws, "
         "perfusionist=act_tan_ek, or_lead_nurse=act_mariam"),
    )
    _assert_a2ui_present(full, blocks)
    assert "expired" in full.lower() or "apc" in full.lower(), f"Expected compliance reason in reply:\n{full[:800]}"


@pytest.mark.asyncio
async def test_allied_health_finds_three() -> None:
    full, blocks = await _run_one(
        "ward.aisha@carelink.demo",
        "Set up post-CABG allied health for case_zainal_2026 — bed 14, ward 4B.",
    )
    _assert_a2ui_present(full, blocks)


@pytest.mark.asyncio
async def test_outcome_form_opens() -> None:
    full, blocks = await _run_one(
        "ward.aisha@carelink.demo",
        "Open the outcome form for case_zainal_2026.",
    )
    _assert_a2ui_present(full, blocks)
