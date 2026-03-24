"""Template, TemplateSession, Section, and Block schemas."""
from typing import Optional, List

from pydantic import BaseModel, ConfigDict


# --- Blocks ---

class BlockRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    estimated_duration_minutes: Optional[int] = None
    tempo_bpm: Optional[int] = None
    key: Optional[str] = None
    difficulty_level: Optional[int] = None
    display_order: int
    curated_block_id: Optional[int] = None


class BlockCreate(BaseModel):
    name: str
    curated_block_id: Optional[int] = None
    description: Optional[str] = None
    estimated_duration_minutes: Optional[int] = None
    tempo_bpm: Optional[int] = None
    key: Optional[str] = None
    difficulty_level: Optional[int] = None


class BlockUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    estimated_duration_minutes: Optional[int] = None
    tempo_bpm: Optional[int] = None
    key: Optional[str] = None
    difficulty_level: Optional[int] = None


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
    name: str
    section_type: str
    estimated_duration_minutes: int = 5


class SectionUpdate(BaseModel):
    name: Optional[str] = None
    section_type: Optional[str] = None
    estimated_duration_minutes: Optional[int] = None


# --- Template Sessions ---

class TemplateSessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    focus_description: Optional[str] = None
    display_order: int
    estimated_duration_minutes: int = 0  # Computed: sum of section durations
    sections: List[SectionRead] = []


class TemplateSessionCreate(BaseModel):
    name: str
    focus_description: Optional[str] = None


class TemplateSessionUpdate(BaseModel):
    name: Optional[str] = None
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


class TemplateListItem(BaseModel):
    """Lightweight template for list views (no nested sessions)."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    instrument_id: int
    name: str
    description: Optional[str] = None
    is_active: bool
    current_rotation_index: int


class TemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


# --- Reorder (shared across sessions, sections, blocks) ---

class ReorderRequest(BaseModel):
    """Reorder items by providing the ordered list of IDs."""
    ordered_ids: List[int]
