from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import List

from app.database import get_session
from app.models import Instrument, User
from app.auth import get_current_user

router = APIRouter(prefix="/instruments", tags=["instruments"])


@router.get("/", response_model=List[Instrument])
async def list_instruments(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get all available instruments (user's own + system instruments)."""
    statement = select(Instrument).where(
        (Instrument.user_id == current_user.id) | (Instrument.is_system == True)
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
    # Only allow access to user's own instruments or system instruments
    statement = select(Instrument).where(
        Instrument.id == instrument_id,
        (Instrument.user_id == current_user.id) | (Instrument.is_system == True)
    )
    result = await session.exec(statement)
    instrument = result.one_or_none()
    
    if not instrument:
        raise HTTPException(status_code=404, detail="Instrument not found")
    return instrument


@router.post("/{instrument_id}/copy", response_model=Instrument, status_code=201)
async def copy_instrument(
    instrument_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Copy a system instrument to user's account."""
    # Get the system instrument
    statement = select(Instrument).where(
        Instrument.id == instrument_id,
        Instrument.is_system == True
    )
    result = await session.exec(statement)
    system_instrument = result.one_or_none()
    
    if not system_instrument:
        raise HTTPException(status_code=404, detail="System instrument not found")
    
    # Check if user already has an instrument with this name
    existing_statement = select(Instrument).where(
        Instrument.user_id == current_user.id,
        Instrument.name == system_instrument.name
    )
    existing_result = await session.exec(existing_statement)
    if existing_result.one_or_none():
        raise HTTPException(status_code=400, detail="You already have an instrument with this name")
    
    # Create a copy for the user
    user_instrument = Instrument(
        name=system_instrument.name,
        description=system_instrument.description,
        is_system=False,
        user_id=current_user.id
    )
    session.add(user_instrument)
    await session.commit()
    await session.refresh(user_instrument)
    
    return user_instrument
