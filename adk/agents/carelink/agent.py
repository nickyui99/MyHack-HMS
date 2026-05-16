"""CareLink Copilot — ADK orchestrator + 5 specialist agents.

Wire format: each specialist's tools build A2UI v0.9 message lists. The agents'
LLM is instructed to wrap the tool's `a2ui_messages` in `<a2ui-json>...</a2ui-json>`
tags inside its reply. The React renderer parses those blocks and renders surfaces.

Orchestrator is `gemini-3.1-pro-preview` (global endpoint, more careful routing).
Specialists are `gemini-flash-latest` (faster, tool-heavy, lower cost).
"""
from __future__ import annotations

import os

from google.adk.agents import LlmAgent
from google.adk.tools import FunctionTool

from tools import allied_tools, compliance_tools, outcome_tools, referral_tools, team_tools
from tools.common import A2UI_OUTPUT_RULES


ORCHESTRATOR_MODEL = os.environ.get("CARELINK_ORCHESTRATOR_MODEL", "gemini-flash-latest")
SPECIALIST_MODEL = os.environ.get("CARELINK_SPECIALIST_MODEL", "gemini-pro-latest")


# ---- Specialist agents ---------------------------------------------------- #

referral_agent = LlmAgent(
    name="referral",
    model=SPECIALIST_MODEL,
    description=("Handles GP-to-cardiologist referrals. Use this when the GP wants to "
                 "surface candidate specialists or commit a referral."),
    instruction=(
        "You are the CareLink Referral specialist for Malaysian GPs.\n"
        "Call exactly one tool per turn:\n"
        "  - `find_cardiologist_candidates(case_id, top_n=3)` to list candidates\n"
        "  - `confirm_referral(case_id, cardio_actor_id)` to commit one\n"
        "Default `case_id` is `case_zainal_2026` unless the user names another.\n"
        "The default GP actor is `act_amirul`.\n"
        f"{A2UI_OUTPUT_RULES}"
    ),
    tools=[
        FunctionTool(referral_tools.find_cardiologist_candidates),
        FunctionTool(referral_tools.confirm_referral),
    ],
    output_key="referral_result",
)


team_assembly_agent = LlmAgent(
    name="team_assembly",
    model=SPECIALIST_MODEL,
    description=("Assembles surgical teams (CABG by default). Use when the OR coordinator "
                 "asks to assemble or lock a team."),
    instruction=(
        "You are the CareLink Team Assembly specialist.\n"
        "Call exactly one tool per turn:\n"
        "  - `find_surgical_team(case_id)` to surface the 4-role picker\n"
        "  - `lock_team(case_id, picks)` to validate + commit (picks = {role: actor_id})\n"
        "Default case_id is `case_zainal_2026`.\n"
        "If `lock_team` reports `compliance_failed`, emit the compliance surface "
        "it already returned — do not retry the same picks.\n"
        f"{A2UI_OUTPUT_RULES}"
    ),
    tools=[
        FunctionTool(team_tools.find_surgical_team),
        FunctionTool(team_tools.lock_team),
    ],
    output_key="team_result",
)


allied_health_agent = LlmAgent(
    name="allied_health",
    model=SPECIALIST_MODEL,
    description=("Coordinates post-op allied health (physio / dietician / OT) for ward patients."),
    instruction=(
        "You are the CareLink Allied Health specialist for ward nurses.\n"
        "Call exactly one tool per turn:\n"
        "  - `find_allied_specialists(case_id)` to surface 3 candidates\n"
        "  - `book_specialist(case_id, role, actor_id)` to book one\n"
        "Default case_id is `case_zainal_2026`.\n"
        f"{A2UI_OUTPUT_RULES}"
    ),
    tools=[
        FunctionTool(allied_tools.find_allied_specialists),
        FunctionTool(allied_tools.book_specialist),
    ],
    output_key="allied_result",
)


compliance_agent = LlmAgent(
    name="compliance",
    model=SPECIALIST_MODEL,
    description=("Deterministic compliance guard. Verifies APC, capacity, subspecialty, "
                 "and insurance panel fit. Invoked automatically when other agents detect issues."),
    instruction=(
        "You are the CareLink Compliance specialist. You operate on hard rules — "
        "you do NOT exercise clinical judgment. Call exactly one tool:\n"
        "  - `validate_actor(actor_id, case_id)` for a single actor\n"
        "  - `validate_team_picks(case_id, picks)` for a 4-role team\n"
        "Pass the tool result through as-is.\n"
        f"{A2UI_OUTPUT_RULES}"
    ),
    tools=[
        FunctionTool(compliance_tools.validate_actor),
        FunctionTool(compliance_tools.validate_team_picks),
    ],
    output_key="compliance_verdict",
)


outcome_agent = LlmAgent(
    name="outcome",
    model=SPECIALIST_MODEL,
    description=("Logs post-op outcomes and updates relationship weights in the knowledge graph."),
    instruction=(
        "You are the CareLink Outcome specialist.\n"
        "Call exactly one tool per turn:\n"
        "  - `open_outcome_form(case_id)` to surface the form\n"
        "  - `record_case_outcome(case_id, surgical_score, complications, notes)` to commit\n"
        "Default case_id is `case_zainal_2026`. surgical_score is 1-5; complications is "
        "'0' / 'minor' / 'major'.\n"
        f"{A2UI_OUTPUT_RULES}"
    ),
    tools=[
        FunctionTool(outcome_tools.open_outcome_form),
        FunctionTool(outcome_tools.record_case_outcome),
    ],
    output_key="outcome_result",
)


# ---- Orchestrator --------------------------------------------------------- #

root_agent = LlmAgent(
    name="carelink_orchestrator",
    model=ORCHESTRATOR_MODEL,
    description="CareLink Copilot orchestrator — routes hospital workflow intents to the right specialist.",
    instruction=(
        "You are CareLink Copilot, an AI assistant for a Malaysian hospital ecosystem. "
        "You orchestrate 5 specialist sub-agents, each owning one workflow:\n"
        "  - `referral` — GP-to-cardiologist referrals\n"
        "  - `team_assembly` — surgical team assembly (CABG)\n"
        "  - `allied_health` — post-op physio / dietician / OT booking\n"
        "  - `compliance` — APC / capacity / panel checks (auto-invoked by other agents)\n"
        "  - `outcome` — post-op outcome logging + KG weight updates\n\n"
        "Routing rules:\n"
        "  - Always read the session state `persona.allowed_agents` and only "
        "    `transfer_to_agent` to a name in that list.\n"
        "  - If the user's intent is outside scope, reply with a brief refusal — "
        "    do NOT invent or guess.\n"
        "  - If the user just says hi or asks 'what can you do?', greet them by name "
        "    (`persona.display_name`) and list the agents they are scoped to.\n"
        "  - For any clinical action, transfer to the relevant specialist. Do not call "
        "    tools directly.\n"
        "  - You may transfer to `compliance` regardless of allowed_agents if a specialist "
        "    reports a `compliance_failed` payload.\n"
    ),
    sub_agents=[
        referral_agent,
        team_assembly_agent,
        allied_health_agent,
        compliance_agent,
        outcome_agent,
    ],
)
