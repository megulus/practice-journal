"""
Instruments API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from sqlalchemy import exists
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import List

from app.database import get_session
from app.models import Instrument, User, UserInstrument
from app.auth import get_current_user

router = APIRouter(prefix="/instruments", tags=["instruments"])


@router.get("/available", response_model=List[Instrument])
async def list_available_instruments(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get instruments available for the user to add.
    Returns system instruments and shareable custom instruments,
    excluding instruments the user already has.
    """
    # Use NOT EXISTS subquery instead of NOT IN for better performance
    user_has_instrument = exists(
        select(UserInstrument.id).where(
            UserInstrument.user_id == current_user.id,
            UserInstrument.instrument_id == Instrument.id
        )
    )

    # Get available instruments (system or shareable, not deleted, not already owned)
    statement = select(Instrument).where(
        Instrument.deleted_at == None,
        (Instrument.is_system == True) | (Instrument.is_shareable == True),
        ~user_has_instrument
    )

    result = await session.exec(statement)
    instruments = result.all()
    return instruments


@router.get("/{instrument_id}", response_model=Instrument)
async def get_instrument(
    instrument_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get a specific instrument by ID."""
    # Allow access to system instruments, shareable instruments, or user's own custom instruments
    statement = select(Instrument).where(
        Instrument.id == instrument_id,
        Instrument.deleted_at == None,
        (Instrument.is_system == True) |
        (Instrument.is_shareable == True) |
        (Instrument.created_by_user_id == current_user.id)
    )
    result = await session.exec(statement)
    instrument = result.one_or_none()

    if not instrument:
        raise HTTPException(status_code=404, detail="Instrument not found")
    return instrument
