"""
Base types for the suggestions engine.

A Rule is just an async function with the signature:

    async def rule(ctx: RuleContext) -> Suggestion | None

The engine handles tier filtering, dismissal lookup, and result selection.
"""
from dataclasses import dataclass
from typing import Optional

from sqlmodel.ext.asyncio.session import AsyncSession

from app.enums import SuggestionTier


@dataclass
class Suggestion:
    rule_id: str
    tier: SuggestionTier
    text: str
    # Optional context for in-session: which block_log this suggestion attaches to
    block_log_id: Optional[int] = None


@dataclass
class RuleContext:
    """All inputs a rule may need to evaluate.

    Not all rules use all fields. The engine populates whatever's relevant
    for the tier being evaluated.
    """
    session: AsyncSession
    user_id: int
    instrument_id: Optional[int] = None
    # In-session-only context
    practice_log_id: Optional[int] = None
    # Per-block-log context (the in-session engine loops over block_logs)
    block_log_id: Optional[int] = None
    block_id: Optional[int] = None
    spot_id: Optional[int] = None
