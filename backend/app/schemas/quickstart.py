"""Quick-start wizard schemas.

The wizard (product spec §5.6) collects instrument, goal, session areas,
current piece, and a time budget, then commits the whole thing in one call.
The *shape* of the generated plan is decided on the frontend — it has to
render a live preview before anything is persisted — so this endpoint takes
the already-balanced section list rather than re-deriving it.
"""
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.enums import SectionType
from app.schemas.instrument import InstrumentRead
from app.schemas.piece import PieceRead
from app.schemas.template import TemplateRead


def _blank_to_none(value: Optional[str]) -> Optional[str]:
    """Treat a whitespace-only optional string as "not provided"."""
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


class QuickStartBlock(BaseModel):
    """The single seed exercise inside a generated section."""

    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=500)


class QuickStartSection(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    section_type: SectionType
    estimated_duration_minutes: int = Field(ge=1, le=600)
    block: QuickStartBlock


class QuickStartRequest(BaseModel):
    """Exactly one of `instrument_id` / `instrument_name` must be sent:
    an id reuses an existing instrument, a name creates a new one."""

    instrument_id: Optional[int] = None
    instrument_name: Optional[str] = Field(default=None, max_length=100)
    plan_name: str = Field(min_length=1, max_length=200)
    # Whatever the user typed at the "anything you're working on?" step.
    # Becomes a Piece in the instrument's library and the repertoire block's
    # subject. Omitted / blank means the repertoire block stays generic.
    piece_name: Optional[str] = Field(default=None, max_length=300)
    sections: List[QuickStartSection] = Field(min_length=1, max_length=12)

    _clean_instrument_name = field_validator("instrument_name")(_blank_to_none)
    _clean_piece_name = field_validator("piece_name")(_blank_to_none)

    @field_validator("plan_name")
    @classmethod
    def _plan_name_not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("plan_name cannot be blank")
        return stripped

    @model_validator(mode="after")
    def _exactly_one_instrument(self) -> "QuickStartRequest":
        if (self.instrument_id is None) == (self.instrument_name is None):
            raise ValueError(
                "send exactly one of instrument_id or instrument_name"
            )
        return self


class QuickStartResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    instrument: InstrumentRead
    template: TemplateRead
    # The one rotation session of the new plan — the frontend starts practice
    # with it directly.
    template_session_id: int
    piece: Optional[PieceRead] = None
