"""Template, TemplateSession, Section, and Block schemas."""
from typing import Optional, List

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.enums import SectionType
from app.schemas.common import reject_explicit_null


# --- Block default spots ---

class DefaultSpotRead(BaseModel):
    """A spot in a repertoire block's default list."""
    id: int
    name: str
    location: Optional[str] = None
    display_order: int


class DefaultSpotAdd(BaseModel):
    spot_id: int


class DefaultSpotReorder(BaseModel):
    spot_ids: List[int]


# --- Blocks ---

class BlockRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: Optional[str] = None
    description: Optional[str] = None
    estimated_duration_minutes: Optional[int] = None
    tempo_bpm: Optional[int] = None
    key: Optional[str] = None
    difficulty_level: Optional[int] = None
    display_order: int
    curated_block_id: Optional[int] = None
    # Repertoire block fields
    piece_id: Optional[int] = None
    piece_name: Optional[str] = None
    default_spots: Optional[List[DefaultSpotRead]] = None


class BlockCreate(BaseModel):
    # Standard block fields
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    curated_block_id: Optional[int] = None
    description: Optional[str] = None
    estimated_duration_minutes: Optional[int] = Field(default=None, ge=1)
    tempo_bpm: Optional[int] = Field(default=None, ge=1, le=999)
    key: Optional[str] = None
    difficulty_level: Optional[int] = Field(default=None, ge=1, le=5)
    # Repertoire block fields
    piece_id: Optional[int] = None
    default_spot_ids: Optional[List[int]] = None

    @field_validator("default_spot_ids")
    @classmethod
    def no_duplicate_spots(cls, v: Optional[List[int]]) -> Optional[List[int]]:
        if v and len(v) != len(set(v)):
            raise ValueError("default_spot_ids must not contain duplicates")
        return v

    @model_validator(mode="after")
    def validate_block_flavor(self):
        if self.piece_id is not None:
            # Repertoire block — name is optional (inherited from piece)
            if self.curated_block_id is not None:
                raise ValueError(
                    "A block cannot have both piece_id and curated_block_id"
                )
        else:
            # Standard block — name is required
            if not self.name:
                raise ValueError("name is required for standard blocks")
            if self.default_spot_ids:
                raise ValueError("default_spot_ids requires piece_id")
        return self


class BlockUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    estimated_duration_minutes: Optional[int] = Field(default=None, ge=1)
    tempo_bpm: Optional[int] = Field(default=None, ge=1, le=999)
    key: Optional[str] = None
    difficulty_level: Optional[int] = Field(default=None, ge=1, le=5)


# --- Sections ---

class SectionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    section_type: str
    estimated_duration_minutes: int
    display_order: int
    blocks: List[BlockRead] = []


class SectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    section_type: SectionType
    estimated_duration_minutes: int = Field(default=5, ge=1)


class SectionUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    section_type: Optional[SectionType] = None
    estimated_duration_minutes: Optional[int] = Field(default=None, ge=1)


# --- Template Sessions ---

class TemplateSessionRead(BaseModel):
    """Read schema for template sessions.

    `estimated_duration_minutes` is computed (sum of section durations) and must
    be populated by the route handler before serialization — it does not exist
    on the ORM model.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    focus_description: Optional[str] = None
    display_order: int
    estimated_duration_minutes: int = 0
    sections: List[SectionRead] = []


class TemplateSessionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    focus_description: Optional[str] = None


class TemplateSessionUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    focus_description: Optional[str] = None


# --- Templates ---

class TemplateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    instrument_id: int
    name: str
    description: Optional[str] = None
    is_active: bool
    current_rotation_index: int
    sessions: List[TemplateSessionRead] = []


class TemplateUpdateRead(TemplateRead):
    """`PATCH /api/templates/{id}` response — a `TemplateRead` plus the name of
    the template this request displaced.

    Activating a template deactivates the instrument's current active one, so
    one request changes a template the client never named. The extra field
    carries that template's name, and is set *only* when the write actually
    displaced something: it is null when `is_active` wasn't set to true, when
    the template was already active, and when the instrument had no active
    template. The client needs it to tell the user which plan it just archived
    on their behalf, and the PATCH already has it in hand — the only
    alternative is a separate lookup of the instrument's template list (#289).
    """

    deactivated_template_name: Optional[str] = None


class TemplateListItem(BaseModel):
    """Lightweight template for list views (no nested sessions).

    `session_count` and `estimated_total_minutes` are computed aggregates:
    the number of sessions in the plan and the sum of every section's
    estimated duration across all of them.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    instrument_id: int
    name: str
    description: Optional[str] = None
    is_active: bool
    current_rotation_index: int
    session_count: int = 0
    estimated_total_minutes: int = 0


class TemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None


class TemplateUpdate(BaseModel):
    # Every field is `Optional[...]` so that omitting it means "leave
    # unchanged", but `templates.name` and `templates.is_active` are NOT NULL.
    # `description` is genuinely nullable, so it stays off the validator below
    # and an explicit `null` there keeps meaning "clear this field" (#280).
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    is_active: Optional[bool] = None

    _no_null = field_validator("name", "is_active")(reject_explicit_null)


# --- Duplication ---

class DuplicateRequest(BaseModel):
    copy_default_spots: bool = True


# --- Reorder (shared across sessions, sections, blocks) ---

class ReorderRequest(BaseModel):
    """Reorder items by providing the ordered list of IDs."""
    ordered_ids: List[int]
