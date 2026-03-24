"""Suggestion schemas."""
from typing import Optional, Dict
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.enums import SuggestionTier, InteractionType


class SuggestionItem(BaseModel):
    rule_id: str
    tier: str
    text: str


class PreSessionResponse(BaseModel):
    suggestion: Optional[SuggestionItem] = None


class InSessionSuggestion(BaseModel):
    rule_id: str
    text: str


class InSessionResponse(BaseModel):
    """Suggestions keyed by block_log_id."""
    suggestions: Dict[str, InSessionSuggestion] = {}


class SuggestionDismissRequest(BaseModel):
    rule_id: str
    instrument_id: Optional[int] = None
    tier: SuggestionTier


class SuggestionInteractionCreate(BaseModel):
    suggestion_rule_id: str
    suggestion_tier: SuggestionTier
    suggestion_text: str
    interaction_type: InteractionType
    instrument_id: Optional[int] = None


class SuggestionInteractionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    suggestion_rule_id: str
    suggestion_tier: str
    suggestion_text: str
    interaction_type: str
    instrument_id: Optional[int] = None
    created_at: datetime
