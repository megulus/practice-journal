"""
Suggestions engine — coaching nudges for the Kantelo product.

Exposes a small surface to API routes:
- evaluate_pre_session(...)
- evaluate_in_session(...)
- evaluate_post_session(...)
- evaluate_pattern_level(...)

Each rule is implemented as an async function in `rules.py` that takes a
RuleContext and returns either a Suggestion or None.
"""
from app.suggestions.base import RuleContext, Suggestion
from app.suggestions.engine import (
    evaluate_pre_session,
    evaluate_in_session,
    evaluate_post_session,
    evaluate_pattern_level,
)

__all__ = [
    "RuleContext",
    "Suggestion",
    "evaluate_pre_session",
    "evaluate_in_session",
    "evaluate_post_session",
    "evaluate_pattern_level",
]
