"""Drive the live ADK server through the 4-stage demo and print what each surface contains.

The frontend would read `functionResponse.response.a2ui_messages` (deterministic
builder output, schema-validated). We do the same here — bypass the LLM's
text-re-paste imperfections.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.request

BASE = os.environ.get("CARELINK_ADK_URL", "http://localhost:8000")
APP = "carelink"


def _post(path: str, body: dict) -> dict | list:
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read())


def ensure_session(user_id: str, session_id: str, persona: dict) -> None:
    body = {
        "state": {
            "persona": persona,
            "case_ctx": {"case_id": "case_zainal_2026", "patient_pseudonym": "Encik Zainal", "panel": "Prudential"},
            "active_surface_map": {},
        }
    }
    try:
        _post(f"/apps/{APP}/users/{user_id}/sessions/{session_id}", body)
    except urllib.error.HTTPError as ex:
        if ex.code != 400:  # 400 = session already exists in some impls
            raise


def run_turn(user_id: str, session_id: str, text: str) -> list:
    events = _post("/run", {
        "appName": APP,
        "userId": user_id,
        "sessionId": session_id,
        "newMessage": {"role": "user", "parts": [{"text": text}]},
    })
    return events  # type: ignore[return-value]


def report(label: str, events: list) -> None:
    print()
    print("=" * 72)
    print(label)
    print("=" * 72)
    for i, e in enumerate(events):
        author = e.get("author", "?")
        for p in (e.get("content") or {}).get("parts") or []:
            if p.get("functionCall"):
                fc = p["functionCall"]
                args_summary = {k: (str(v)[:60] + "..." if len(str(v)) > 60 else v) for k, v in (fc.get("args") or {}).items()}
                print(f"  [{i}] {author:30s} CALL    {fc['name']}({args_summary})")
            elif p.get("functionResponse"):
                fr = p["functionResponse"]
                r = fr.get("response") or {}
                cap = r.get("caption", "(none)") if isinstance(r, dict) else "(none)"
                print(f"  [{i}] {author:30s} RESULT  {fr['name']}: {cap!r}")
                if isinstance(r, dict) and "a2ui_messages" in r:
                    msgs = r["a2ui_messages"]
                    surface_id = ""
                    n_components = 0
                    n_data_models = 0
                    for m in msgs:
                        if "createSurface" in m:
                            surface_id = m["createSurface"]["surfaceId"]
                        elif "updateComponents" in m:
                            n_components = len(m["updateComponents"]["components"])
                        elif "updateDataModel" in m:
                            n_data_models += 1
                    print(f"          A2UI: surface={surface_id}, {len(msgs)} msgs, "
                          f"{n_components} components, {n_data_models} data-model preload")
                if isinstance(r, dict):
                    for extra_key in ("candidates", "specialists", "compliance_failed", "team_score", "weight_changes"):
                        v = r.get(extra_key)
                        if v:
                            if isinstance(v, list):
                                print(f"          {extra_key} ({len(v)}):")
                                for item in v[:4]:
                                    print(f"            - {item}")
                            else:
                                print(f"          {extra_key}: {v}")
            elif p.get("text"):
                t = p["text"]
                blocks = t.count("<a2ui-json>")
                preface = t.split("<a2ui-json>", 1)[0].strip() if "<a2ui-json>" in t else t.strip()
                print(f"  [{i}] {author:30s} TEXT    (a2ui blocks in text: {blocks})")
                if preface:
                    print(f"          caption: {preface[:200]}")


PERSONAS = {
    "amirul": {"user_id": "gp.amirul@carelink.demo", "display_name": "Dr Amirul Hassan",
               "role": "general_practitioner", "allowed_agents": ["referral"]},
    "suri":   {"user_id": "coord.suri@carelink.demo", "display_name": "Suri Wong",
               "role": "or_coordinator", "allowed_agents": ["team_assembly"]},
    "aisha":  {"user_id": "ward.aisha@carelink.demo", "display_name": "Nurse Aisha Rahman",
               "role": "ward_nurse", "allowed_agents": ["allied_health", "outcome"]},
}


def main() -> None:
    # Stage 1 — Amirul referral
    ensure_session("gp.amirul@carelink.demo", "demo-amirul", PERSONAS["amirul"])
    ev = run_turn("gp.amirul@carelink.demo", "demo-amirul",
                  "I have a 58yo male with suspected NSTEMI on Prudential panel in Puchong. "
                  "Find me top cardiologist candidates for case_zainal_2026.")
    report("STAGE 1 — Dr Amirul: GP referral request", ev)

    # Stage 2 — Suri assembles team
    ensure_session("coord.suri@carelink.demo", "demo-suri", PERSONAS["suri"])
    ev = run_turn("coord.suri@carelink.demo", "demo-suri",
                  "Assemble the CABG team for case_zainal_2026.")
    report("STAGE 2 — Suri Wong: surgical team picker", ev)

    # Stage 2b — Suri locks team WITH BOOBY TRAP (Dr Lim's expired APC)
    ev = run_turn("coord.suri@carelink.demo", "demo-suri",
                  "Lock this team for case_zainal_2026: "
                  "cardiothoracic_surgeon=act_suresh, "
                  "cardiac_anaesthetist=act_lim_ws, "
                  "perfusionist=act_tan_ek, "
                  "or_lead_nurse=act_mariam.")
    report("STAGE 2b — Suri: lock_team with Dr Lim (expired APC) → compliance interrupt", ev)

    # Stage 3 — Aisha allied health
    ensure_session("ward.aisha@carelink.demo", "demo-aisha", PERSONAS["aisha"])
    ev = run_turn("ward.aisha@carelink.demo", "demo-aisha",
                  "Set up post-CABG allied health for case_zainal_2026 — Bed 14, Ward 4B.")
    report("STAGE 3 — Aisha: allied health booking", ev)

    # Stage 4 — Aisha logs outcome
    ev = run_turn("ward.aisha@carelink.demo", "demo-aisha",
                  "Open the outcome form for case_zainal_2026.")
    report("STAGE 4 — Aisha: outcome form", ev)


if __name__ == "__main__":
    main()
