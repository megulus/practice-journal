"""
Instruments API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
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
    # Get IDs of instruments the user already has
    user_instrument_result = await session.exec(
        select(UserInstrument.instrument_id)
        .where(UserInstrument.user_id == current_user.id)
    )
    user_instrument_ids = user_instrument_result.all()

    # Get available instruments (system or shareable, not deleted, not already owned)
    statement = select(Instrument).where(
        Instrument.deleted_at == None,
        (Instrument.is_system == True) | (Instrument.is_shareable == True)
    )

    if user_instrument_ids:
        statement = statement.where(Instrument.id.not_in(user_instrument_ids))

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


# =============================================================================
# DEPRECATED ENDPOINTS - Keep for backwards compatibility during migration
# =============================================================================

@router.get("/", response_model=List[Instrument], deprecated=True)
async def list_instruments(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    DEPRECATED: Use GET /api/user/instruments instead.
    Get all available instruments (system instruments).
    """
    statement = select(Instrument).where(
        Instrument.is_system == True,
        Instrument.deleted_at == None
    )
    result = await session.exec(statement)
    instruments = result.all()
    return instruments


@router.post("/{instrument_id}/copy", response_model=Instrument, status_code=201, deprecated=True)
async def copy_instrument(
    instrument_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    DEPRECATED: Use POST /api/user/instruments instead.
    This endpoint now creates a UserInstrument record instead of copying the instrument.
    """
    # Get the system instrument
    statement = select(Instrument).where(
        Instrument.id == instrument_id,
        Instrument.is_system == True,
        Instrument.deleted_at == None
    )
    result = await session.exec(statement)
    system_instrument = result.one_or_none()

    if not system_instrument:
        raise HTTPException(status_code=404, detail="System instrument not found")

    # Check if user already has this instrument
    existing_result = await session.exec(
        select(UserInstrument).where(
            UserInstrument.user_id == current_user.id,
            UserInstrument.instrument_id == instrument_id
        )
    )
    if existing_result.one_or_none():
        raise HTTPException(status_code=400, detail="You already have this instrument")

    # Create user instrument link (new behavior)
    user_instrument = UserInstrument(
        user_id=current_user.id,
        instrument_id=instrument_id,
        display_order=0
    )
    session.add(user_instrument)
    await session.commit()

    # Return the system instrument (for backwards compatibility)
    return system_instrument
