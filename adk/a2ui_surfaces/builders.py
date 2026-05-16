"""Deterministic A2UI v0.9 surface builders.

Each builder returns:
  {
    "surface_id": "srf_<agent>_<uuid8>",
    "messages": [createSurface_msg, updateComponents_msg],
  }

The two-message bundle (createSurface then updateComponents) is the full
contract a v0.9 renderer needs to display the surface. Tools embed the
`messages` list in their return; the agent's LLM prompt instructs it to quote
the list verbatim inside `<a2ui-json>...</a2ui-json>` tags.

Schema reference: a2ui.assets/0.9/{basic_catalog.json, server_to_client.json,
common_types.json}.
"""
from __future__ import annotations

import uuid
from typing import Any

from a2ui_surfaces.allowed_components import A2UI_VERSION, CATALOG_ID_V09


def new_surface_id(agent: str) -> str:
    return f"srf_{agent}_{uuid.uuid4().hex[:10]}"


def _create_surface(surface_id: str) -> dict[str, Any]:
    return {
        "version": A2UI_VERSION,
        "createSurface": {"surfaceId": surface_id, "catalogId": CATALOG_ID_V09},
    }


def _update(surface_id: str, components: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "version": A2UI_VERSION,
        "updateComponents": {"surfaceId": surface_id, "components": components},
    }


def _update_data_model(surface_id: str, value: dict[str, Any], path: str = "/") -> dict[str, Any]:
    return {
        "version": A2UI_VERSION,
        "updateDataModel": {"surfaceId": surface_id, "path": path, "value": value},
    }


# ---- Component primitives ------------------------------------------------- #

def _text(component_id: str, value: str, *, variant: str | None = None) -> dict[str, Any]:
    node: dict[str, Any] = {"id": component_id, "component": "Text", "text": value}
    if variant:
        node["variant"] = variant
    return node


def _column(component_id: str, children: list[str]) -> dict[str, Any]:
    return {"id": component_id, "component": "Column", "children": list(children)}


def _row(component_id: str, children: list[str]) -> dict[str, Any]:
    return {"id": component_id, "component": "Row", "children": list(children)}


def _card(component_id: str, child_id: str) -> dict[str, Any]:
    return {"id": component_id, "component": "Card", "child": child_id}


def _button(component_id: str, child_text_id: str, event_name: str, context: dict[str, Any], *, variant: str = "primary") -> dict[str, Any]:
    return {
        "id": component_id,
        "component": "Button",
        "child": child_text_id,
        "variant": variant,
        "action": {"event": {"name": event_name, "context": context}},
    }


def _choice_picker(component_id: str, label: str, options: list[dict[str, Any]], value_path: str, *, variant: str = "mutuallyExclusive") -> dict[str, Any]:
    return {
        "id": component_id,
        "component": "ChoicePicker",
        "label": label,
        "variant": variant,
        "options": [{"label": o["label"], "value": o["value"]} for o in options],
        "value": {"path": value_path},
    }


def _text_field(component_id: str, label: str, value_path: str) -> dict[str, Any]:
    return {
        "id": component_id,
        "component": "TextField",
        "label": label,
        "value": {"path": value_path},
    }


# ---- Surface builders ----------------------------------------------------- #

def build_simple_text_surface(agent: str, title: str, body: str, surface_id: str | None = None) -> dict[str, Any]:
    sid = surface_id or new_surface_id(agent)
    components = [
        _column("root", ["t1", "t2"]),
        _text("t1", title, variant="h2"),
        _text("t2", body),
    ]
    return {"surface_id": sid, "messages": [_create_surface(sid), _update(sid, components)]}


def build_referral_candidates_surface(candidates: list[dict[str, Any]], case_id: str, surface_id: str | None = None) -> dict[str, Any]:
    """candidates: [{actor_id, name, hospital_name, breakdown_text, score, prior_pair_count}]"""
    sid = surface_id or new_surface_id("referral")
    children = ["title", "subtitle"]
    components: list[dict[str, Any]] = [
        _text("title", "Cardiologist candidates", variant="h2"),
        _text("subtitle", f"Case {case_id} — Encik Zainal", variant="caption"),
    ]

    for i, c in enumerate(candidates, 1):
        name_id = f"name_{i}"
        score_id = f"score_{i}"
        prior_id = f"prior_{i}"
        btn_label_id = f"btnlbl_{i}"
        btn_id = f"btn_{i}"
        inner_col_id = f"col_{i}"
        card_id = f"card_{i}"

        components += [
            _text(name_id, f"{c['name']} — {c['hospital_name']}", variant="h3"),
            _text(score_id, f"Match {c['score']*100:.0f}% · {c['breakdown_text']}"),
            _text(prior_id, f"{c.get('prior_pair_count', 0)} prior referrals with this GP"),
            _text(btn_label_id, "Confirm referral"),
            _button(btn_id, btn_label_id, "confirm_referral", {"case_id": case_id, "cardio_actor_id": c["actor_id"]}),
            _column(inner_col_id, [name_id, score_id, prior_id, btn_id]),
            _card(card_id, inner_col_id),
        ]
        children.append(card_id)

    components.insert(0, _column("root", children))
    return {"surface_id": sid, "messages": [_create_surface(sid), _update(sid, components)]}


def build_team_picker_surface(roles_with_candidates: dict[str, list[dict[str, Any]]], case_id: str, default_picks: dict[str, str], surface_id: str | None = None) -> dict[str, Any]:
    """roles_with_candidates: {role_label: [{actor_id, name, score, apc_status_text}, ...]}"""
    sid = surface_id or new_surface_id("team_assembly")
    children = ["title", "subtitle"]
    components: list[dict[str, Any]] = [
        _text("title", "Assemble CABG team — Encik Zainal", variant="h2"),
        _text("subtitle", "OR-2 · 07:00 tomorrow · pick one per role", variant="caption"),
    ]
    picks_payload: dict[str, str] = {}
    for ri, (role, cands) in enumerate(roles_with_candidates.items(), 1):
        opts = [{"value": c["actor_id"], "label": f"{c['name']} · {c['score']*100:.0f}% · {c.get('apc_status_text','APC valid')}"} for c in cands]
        picker_id = f"pick_{ri}"
        label_id = f"role_{ri}"
        default = default_picks.get(role) or (cands[0]["actor_id"] if cands else "")
        picks_payload[role] = default
        components += [
            _text(label_id, role.replace("_", " ").title(), variant="h3"),
            _choice_picker(picker_id, "Choose", opts, f"picks.{role}"),
        ]
        children += [label_id, picker_id]

    lock_label_id = "lock_label"
    lock_btn_id = "lock_btn"
    components += [
        _text(lock_label_id, "Lock team"),
        # Picks are read from the data model (populated by ChoicePickers + defaults).
        _button(lock_btn_id, lock_label_id, "lock_team", {"case_id": case_id, "picks": {"path": "picks"}}),
    ]
    children.append(lock_btn_id)
    components.insert(0, _column("root", children))
    return {
        "surface_id": sid,
        "messages": [
            _create_surface(sid),
            _update_data_model(sid, {"picks": picks_payload}),
            _update(sid, components),
        ],
    }


def build_allied_cards_surface(specialists: list[dict[str, Any]], case_id: str, surface_id: str | None = None) -> dict[str, Any]:
    """specialists: [{role, actor_id, name, breakdown_text, score}]"""
    sid = surface_id or new_surface_id("allied_health")
    children = ["title", "subtitle"]
    components: list[dict[str, Any]] = [
        _text("title", "Post-CABG allied health", variant="h2"),
        _text("subtitle", "Ward 4B · Bed 14 · one-click book", variant="caption"),
    ]
    for i, s in enumerate(specialists, 1):
        name_id = f"name_{i}"
        score_id = f"score_{i}"
        btn_label_id = f"btnlbl_{i}"
        btn_id = f"book_{i}"
        inner_id = f"col_{i}"
        card_id = f"card_{i}"
        components += [
            _text(name_id, f"{s['role'].replace('_',' ').title()} — {s['name']}", variant="h3"),
            _text(score_id, f"Match {s['score']*100:.0f}% · {s['breakdown_text']}"),
            _text(btn_label_id, "Book"),
            _button(btn_id, btn_label_id, "book_specialist", {"case_id": case_id, "role": s["role"], "actor_id": s["actor_id"]}),
            _column(inner_id, [name_id, score_id, btn_id]),
            _card(card_id, inner_id),
        ]
        children.append(card_id)
    components.insert(0, _column("root", children))
    return {"surface_id": sid, "messages": [_create_surface(sid), _update(sid, components)]}


def build_compliance_block_surface(failed: list[dict[str, Any]], case_id: str, surface_id: str | None = None) -> dict[str, Any]:
    """failed: [{role, actor_id, actor: {name}, reasons: [str]}]"""
    sid = surface_id or new_surface_id("compliance")
    children = ["title", "intro"]
    components: list[dict[str, Any]] = [
        _text("title", "⛔ Compliance block", variant="h2"),
        _text("intro", "The following picks cannot proceed:", variant="caption"),
    ]
    for i, f in enumerate(failed, 1):
        name_id = f"fn_{i}"
        reasons_id = f"fr_{i}"
        inner_id = f"fcol_{i}"
        card_id = f"fcard_{i}"
        components += [
            _text(name_id, f"{f.get('actor',{}).get('name','?')} ({f['role'].replace('_',' ').title()})", variant="h3"),
            _text(reasons_id, " · ".join(f.get("reasons", []))),
            _column(inner_id, [name_id, reasons_id]),
            _card(card_id, inner_id),
        ]
        children.append(card_id)
    pa_lbl_id, pa_btn_id = "pa_lbl", "pick_again_btn"
    ov_lbl_id, ov_btn_id = "ov_lbl", "override_btn"
    components += [
        _text(pa_lbl_id, "Pick different actor"),
        _button(pa_btn_id, pa_lbl_id, "team_pick_again", {"case_id": case_id}),
        _text(ov_lbl_id, "Override with justification"),
        _button(ov_btn_id, ov_lbl_id, "compliance_override", {"case_id": case_id}, variant="default"),
    ]
    children += [pa_btn_id, ov_btn_id]
    components.insert(0, _column("root", children))
    return {"surface_id": sid, "messages": [_create_surface(sid), _update(sid, components)]}


def build_outcome_form_surface(case_id: str, surface_id: str | None = None) -> dict[str, Any]:
    sid = surface_id or new_surface_id("outcome")
    submit_lbl = "submit_lbl"
    components: list[dict[str, Any]] = [
        _column("root", ["title", "subtitle", "surg", "comp", "notes", "submit_btn"]),
        _text("title", "Log outcome — Encik Zainal", variant="h2"),
        _text("subtitle", "Day 2 post-op · Ward 4B", variant="caption"),
        _choice_picker("surg", "Surgical score (1-5)", [{"value": str(n), "label": str(n)} for n in range(1, 6)], "outcome.surgical_score"),
        _choice_picker("comp", "Complications", [{"value": "0", "label": "None"}, {"value": "minor", "label": "Minor"}, {"value": "major", "label": "Major"}], "outcome.complications"),
        _text_field("notes", "Notes (optional)", "outcome.notes"),
        _text(submit_lbl, "Submit outcome"),
        _button("submit_btn", submit_lbl, "record_case_outcome", {"case_id": case_id}),
    ]
    return {"surface_id": sid, "messages": [_create_surface(sid), _update(sid, components)]}


def build_outcome_delta_surface(delta: dict[str, Any], surface_id: str | None = None) -> dict[str, Any]:
    sid = surface_id or new_surface_id("outcome")
    changes = delta.get("weight_changes", [])
    summary = f"Updated {len(changes)} relationship weights. Graph delta: +{len(delta.get('nodes_added', []))} nodes, +{len(delta.get('edges_added', []))} edges."
    detail_lines = [f"{c['relationship_id']}: {c['from']:.3f} → {c['to']:.3f} ({c['delta']:+.3f})" for c in changes] or ["no changes"]
    components: list[dict[str, Any]] = [
        _column("root", ["title", "summary", "details"]),
        _text("title", "Outcome recorded — relationships updated", variant="h2"),
        _text("summary", summary, variant="body"),
        _text("details", "\n".join(detail_lines), variant="caption"),
    ]
    return {"surface_id": sid, "messages": [_create_surface(sid), _update(sid, components)]}
