"""
Kantelo models package.

All table models are re-exported here so that:
  1. Alembic can detect them via `from app.models import *`
  2. Other modules can import from `app.models` directly
"""
from app.models.user import User, UserSettings
from app.models.instrument import Instrument
from app.models.piece import Piece, Spot, TemplateBlockSpot
from app.models.template import Template, TemplateSession, Section, Block
from app.models.curated import CuratedBlock
from app.models.practice import PracticeLog, SectionLog, BlockLog
from app.models.suggestion import SuggestionDismissal, SuggestionInteraction
from app.models.idempotency import IdempotencyRecord

__all__ = [
    "User",
    "UserSettings",
    "Instrument",
    "Piece",
    "Spot",
    "TemplateBlockSpot",
    "Template",
    "TemplateSession",
    "Section",
    "Block",
    "CuratedBlock",
    "PracticeLog",
    "SectionLog",
    "BlockLog",
    "SuggestionDismissal",
    "SuggestionInteraction",
    "IdempotencyRecord",
]
