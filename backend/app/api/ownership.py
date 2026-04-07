"""
Shared ownership helpers for verifying resource access.

These functions fetch a resource while verifying that it belongs to the
requesting user. They raise 404 if the resource doesn't exist, is
soft-deleted, or belongs to another user.
"""
from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import Instrument, Template, TemplateSession, Section, Block, Piece, Spot


async def get_owned_instrument(
    session: AsyncSession, instrument_id: int, user_id: int
) -> Instrument:
    """Fetch an instrument, verifying ownership and not deleted."""
    result = await session.exec(
        select(Instrument).where(
            Instrument.id == instrument_id,
            Instrument.user_id == user_id,
            Instrument.deleted_at == None,  # noqa: E711
        )
    )
    instrument = result.first()
    if not instrument:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Instrument not found",
        )
    return instrument


async def get_owned_template(
    session: AsyncSession, template_id: int, user_id: int
) -> Template:
    """Fetch a template, verifying ownership and not deleted."""
    result = await session.exec(
        select(Template).where(
            Template.id == template_id,
            Template.user_id == user_id,
            Template.deleted_at == None,  # noqa: E711
        )
    )
    template = result.first()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )
    return template


async def get_owned_session(
    session: AsyncSession, session_id: int, user_id: int
) -> TemplateSession:
    """Fetch a template session, verifying ownership through the template."""
    result = await session.exec(
        select(TemplateSession)
        .join(Template, TemplateSession.template_id == Template.id)
        .where(
            TemplateSession.id == session_id,
            Template.user_id == user_id,
            Template.deleted_at == None,  # noqa: E711
        )
    )
    ts = result.first()
    if not ts:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    return ts


async def get_owned_section(
    session: AsyncSession, section_id: int, user_id: int
) -> Section:
    """Fetch a section, verifying ownership through the template chain."""
    result = await session.exec(
        select(Section)
        .join(TemplateSession, Section.template_session_id == TemplateSession.id)
        .join(Template, TemplateSession.template_id == Template.id)
        .where(
            Section.id == section_id,
            Template.user_id == user_id,
            Template.deleted_at == None,  # noqa: E711
        )
    )
    sec = result.first()
    if not sec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Section not found",
        )
    return sec


async def get_owned_block(
    session: AsyncSession, block_id: int, user_id: int
) -> Block:
    """Fetch a block, verifying ownership through the template chain."""
    result = await session.exec(
        select(Block)
        .join(Section, Block.section_id == Section.id)
        .join(TemplateSession, Section.template_session_id == TemplateSession.id)
        .join(Template, TemplateSession.template_id == Template.id)
        .where(
            Block.id == block_id,
            Template.user_id == user_id,
            Template.deleted_at == None,  # noqa: E711
        )
    )
    block = result.first()
    if not block:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Block not found",
        )
    return block


async def get_owned_piece(
    session: AsyncSession, piece_id: int, user_id: int
) -> Piece:
    """Fetch a piece, verifying ownership through the instrument."""
    result = await session.exec(
        select(Piece)
        .join(Instrument, Piece.instrument_id == Instrument.id)
        .where(
            Piece.id == piece_id,
            Instrument.user_id == user_id,
            Piece.deleted_at == None,  # noqa: E711
            Instrument.deleted_at == None,  # noqa: E711
        )
    )
    piece = result.first()
    if not piece:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Piece not found",
        )
    return piece


async def get_owned_spot(
    session: AsyncSession, spot_id: int, user_id: int
) -> Spot:
    """Fetch a spot, verifying ownership through piece -> instrument."""
    result = await session.exec(
        select(Spot)
        .join(Piece, Spot.piece_id == Piece.id)
        .join(Instrument, Piece.instrument_id == Instrument.id)
        .where(
            Spot.id == spot_id,
            Instrument.user_id == user_id,
            Spot.deleted_at == None,  # noqa: E711
            Piece.deleted_at == None,  # noqa: E711
            Instrument.deleted_at == None,  # noqa: E711
        )
    )
    spot = result.first()
    if not spot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Spot not found",
        )
    return spot
