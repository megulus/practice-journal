from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class InstrumentBase(BaseModel):
    name: str
    description: Optional[str] = None


class InstrumentCreate(InstrumentBase):
    pass


class Instrument(InstrumentBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


