"""
User Instruments API endpoints
Manages the relationship between users and their instruments
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import select, col
from sqlalchemy.orm import selectinload
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_session
from app.models import UserInstrument, Instrument, User, PracticeTemplate
from app.auth import get_current_user

router = APIRouter(prefix="/user/instruments", tags=["user-instruments"])


class UserInstrumentResponse(BaseModel):
    """Response model for user instrument with nested instrument details"""
    id: int
    user_id: int
    instrument_id: int
    display_order: int
    added_at: str
    instrument: "InstrumentResponse"
    template_count: int = 0

    class Config:
        from_attributes = True


class InstrumentResponse(BaseModel):
    """Response model for instrument details"""
    id: int
    name: str
    description: Optional[str]
    is_system: bool

    class Config:
        from_attributes = True


class AddInstrumentRequest(BaseModel):
    """Request body for adding an instrument"""
    instrument_id: int


class UpdateUserInstrumentRequest(BaseModel):
    """Request body for updating a user instrument"""
    display_order: Optional[int] = None


@router.get("/", response_model=List[UserInstrumentResponse])
async def list_user_instruments(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get all instruments for the current user with template counts."""
    statement = (
        select(UserInstrument)
        .where(UserInstrument.user_id == current_user.id)
        .options(selectinload(UserInstrument.instrument))  # type: ignore[arg-type]
        .order_by(UserInstrument.display_order, UserInstrument.added_at)
    )
    result = await session.exec(statement)
    user_instruments = result.all()

    # Get template counts for each user instrument
    response = []
    for ui in user_instruments:
        template_count_result = await session.exec(
            select(PracticeTemplate)
            .where(
                PracticeTemplate.user_instrument_id == ui.id,
                PracticeTemplate.deleted_at == None
            )
        )
        template_count = len(template_count_result.all())

        response.append(UserInstrumentResponse(
            id=ui.id,
            user_id=ui.user_id,
            instrument_id=ui.instrument_id,
            display_order=ui.display_order,
            added_at=ui.added_at.isoformat(),
            instrument=InstrumentResponse(
                id=ui.instrument.id,
                name=ui.instrument.name,
                description=ui.instrument.description,
                is_system=ui.instrument.is_system
            ),
            template_count=template_count
        ))

    return response


@router.post("/", response_model=UserInstrumentResponse, status_code=201)
async def add_user_instrument(
    body: AddInstrumentRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Add an instrument to the current user's account."""
    # Verify instrument exists and is available (system or shareable)
    instrument_result = await session.exec(
        select(Instrument).where(
            Instrument.id == body.instrument_id,
            Instrument.deleted_at == None,
            (Instrument.is_system == True) | (Instrument.is_shareable == True)
        )
    )
    instrument = instrument_result.one_or_none()

    if not instrument:
        raise HTTPException(status_code=404, detail="Instrument not found or not available")

    # Check if user already has this instrument
    existing_result = await session.exec(
        select(UserInstrument).where(
            UserInstrument.user_id == current_user.id,
            UserInstrument.instrument_id == body.instrument_id
        )
    )
    if existing_result.one_or_none():
        raise HTTPException(status_code=400, detail="You already have this instrument")

    # Get next display order
    max_order_result = await session.exec(
        select(UserInstrument.display_order)
        .where(UserInstrument.user_id == current_user.id)
        .order_by(col(UserInstrument.display_order).desc())
        .limit(1)
    )
    max_order = max_order_result.one_or_none()
    next_order = (max_order or 0) + 1

    # Create user instrument
    user_instrument = UserInstrument(
        user_id=current_user.id,
        instrument_id=body.instrument_id,
        display_order=next_order
    )
    session.add(user_instrument)
    await session.commit()
    await session.refresh(user_instrument)

    return UserInstrumentResponse(
        id=user_instrument.id,
        user_id=user_instrument.user_id,
        instrument_id=user_instrument.instrument_id,
        display_order=user_instrument.display_order,
        added_at=user_instrument.added_at.isoformat(),
        instrument=InstrumentResponse(
            id=instrument.id,
            name=instrument.name,
            description=instrument.description,
            is_system=instrument.is_system
        ),
        template_count=0
    )


@router.delete("/{user_instrument_id}")
async def remove_user_instrument(
    user_instrument_id: int,
    confirm: bool = Query(False, description="Confirm deletion of related templates"),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Remove an instrument from the current user's account.
    If the instrument has templates, requires confirm=true to cascade delete them.
    """
    # Get user instrument
    result = await session.exec(
        select(UserInstrument).where(
            UserInstrument.id == user_instrument_id,
            UserInstrument.user_id == current_user.id
        )
    )
    user_instrument = result.one_or_none()

    if not user_instrument:
        raise HTTPException(status_code=404, detail="Instrument not found in your account")

    # Check for related templates
    template_result = await session.exec(
        select(PracticeTemplate).where(
            PracticeTemplate.user_instrument_id == user_instrument_id,
            PracticeTemplate.deleted_at == None
        )
    )
    templates = template_result.all()

    if templates and not confirm:
        template_names = [t.name for t in templates]
        raise HTTPException(
            status_code=400,
            detail={
                "message": "This instrument has templates that will be deleted",
                "templates": template_names,
                "confirm_required": True
            }
        )

    # Delete related templates (cascade)
    for template in templates:
        await session.delete(template)

    # Delete user instrument
    await session.delete(user_instrument)
    await session.commit()

    return {"status": "ok", "deleted_templates": len(templates)}


@router.patch("/{user_instrument_id}", response_model=UserInstrumentResponse)
async def update_user_instrument(
    user_instrument_id: int,
    body: UpdateUserInstrumentRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update a user instrument (e.g., display order)."""
    result = await session.exec(
        select(UserInstrument)
        .where(
            UserInstrument.id == user_instrument_id,
            UserInstrument.user_id == current_user.id
        )
        .options(selectinload(UserInstrument.instrument))  # type: ignore[arg-type]
    )
    user_instrument = result.one_or_none()

    if not user_instrument:
        raise HTTPException(status_code=404, detail="Instrument not found in your account")

    if body.display_order is not None:
        user_instrument.display_order = body.display_order

    session.add(user_instrument)
    await session.commit()
    await session.refresh(user_instrument)

    # Get template count
    template_count_result = await session.exec(
        select(PracticeTemplate)
        .where(
            PracticeTemplate.user_instrument_id == user_instrument.id,
            PracticeTemplate.deleted_at == None
        )
    )
    template_count = len(template_count_result.all())

    return UserInstrumentResponse(
        id=user_instrument.id,
        user_id=user_instrument.user_id,
        instrument_id=user_instrument.instrument_id,
        display_order=user_instrument.display_order,
        added_at=user_instrument.added_at.isoformat(),
        instrument=InstrumentResponse(
            id=user_instrument.instrument.id,
            name=user_instrument.instrument.name,
            description=user_instrument.instrument.description,
            is_system=user_instrument.instrument.is_system
        ),
        template_count=template_count
    )
