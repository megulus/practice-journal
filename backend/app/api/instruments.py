from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.instrument import Instrument as InstrumentModel
from app.schemas.instrument import Instrument

router = APIRouter(prefix="/instruments", tags=["instruments"])


@router.get("/", response_model=List[Instrument])
def list_instruments(db: Session = Depends(get_db)):
    """Get all available instruments."""
    instruments = db.query(InstrumentModel).all()
    return instruments


@router.get("/{instrument_id}", response_model=Instrument)
def get_instrument(instrument_id: int, db: Session = Depends(get_db)):
    """Get a specific instrument by ID."""
    instrument = db.query(InstrumentModel).filter(InstrumentModel.id == instrument_id).first()
    if not instrument:
        raise HTTPException(status_code=404, detail="Instrument not found")
    return instrument


