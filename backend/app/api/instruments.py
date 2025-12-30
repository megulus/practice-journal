from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import List

from app.database import get_session
from app.models import Instrument

router = APIRouter(prefix="/instruments", tags=["instruments"])


@router.get("/", response_model=List[Instrument])
async def list_instruments(session: AsyncSession = Depends(get_session)):
    """Get all available instruments."""
    result = await session.execute(select(Instrument))
    instruments = result.scalars().all()
    return instruments


@router.get("/{instrument_id}", response_model=Instrument)
async def get_instrument(instrument_id: int, session: AsyncSession = Depends(get_session)):
    """Get a specific instrument by ID."""
    instrument = await session.get(Instrument, instrument_id)
    if not instrument:
        raise HTTPException(status_code=404, detail="Instrument not found")
    return instrument
