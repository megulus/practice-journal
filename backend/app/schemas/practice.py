from pydantic import BaseModel
from typing import Optional, List


class ExerciseBase(BaseModel):
    exercise_text: str
    display_order: int


class Exercise(ExerciseBase):
    id: int

    class Config:
        from_attributes = True


class ExerciseBlockBase(BaseModel):
    block_type: str
    display_order: int


class ExerciseBlock(ExerciseBlockBase):
    id: int
    exercises: List[Exercise] = []

    class Config:
        from_attributes = True


class PracticeDayBase(BaseModel):
    day_number: int
    title: str
    warmup: Optional[str] = None
    scales: Optional[str] = None
    repertoire: Optional[str] = None


class PracticeDay(PracticeDayBase):
    id: int
    exercise_blocks: List[ExerciseBlock] = []

    class Config:
        from_attributes = True


class PracticeTemplateBase(BaseModel):
    name: str
    days_count: int
    description: Optional[str] = None
    is_active: bool = True


class PracticeTemplateCreate(PracticeTemplateBase):
    instrument_id: int


class PracticeTemplate(PracticeTemplateBase):
    id: int
    instrument_id: int

    class Config:
        from_attributes = True


class PracticeTemplateWithDays(PracticeTemplate):
    practice_days: List[PracticeDay] = []

    class Config:
        from_attributes = True


