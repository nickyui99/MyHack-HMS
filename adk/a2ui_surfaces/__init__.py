"""A2UI surface builders + per-agent allow-lists.

Strategy: tools build complete A2UI messages in Python (deterministic, validated)
and return them as part of their result. The LLM only embeds the pre-built payload
in `<a2ui-json>...</a2ui-json>` tags. This dramatically reduces hallucination —
the model is choosing which surface, not generating the JSON.
"""
from a2ui_surfaces.allowed_components import ALLOWED_COMPONENTS
from a2ui_surfaces.builders import (
    build_referral_candidates_surface,
    build_team_picker_surface,
    build_allied_cards_surface,
    build_compliance_block_surface,
    build_outcome_form_surface,
    build_outcome_delta_surface,
    build_simple_text_surface,
)

__all__ = [
    "ALLOWED_COMPONENTS",
    "build_referral_candidates_surface",
    "build_team_picker_surface",
    "build_allied_cards_surface",
    "build_compliance_block_surface",
    "build_outcome_form_surface",
    "build_outcome_delta_surface",
    "build_simple_text_surface",
]
