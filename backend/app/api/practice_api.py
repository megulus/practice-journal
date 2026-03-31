"""
Practice session lifecycle API — core.

Start, read, and update practice sessions. Handles scaffolding from
templates, smart tempo defaults, section-level actions (mark all done,
skip section), and freeform sessions.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select, col
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_session
from app.models import (
    User,
    Instrument,
    Template,
    TemplateSession,
    Section,
    Block,
    PracticeLog,
    SectionLog,
    BlockLog,
)
from app.auth import get_current_user
from app.api.ownership import get_owned_instrument, get_owned_template
from app.enums import SessionStatus, utcnow
from app.schemas.practice import (
    BlockLogRead,
    BlockLogUpdate,
    PracticeLogRead,
    PracticeLogUpdate,
    PracticeStartRequest,
    SectionLogRead,
    SectionLogUpdate,
)

router = APIRouter(tags=["practice"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_owned_log(
    session: AsyncSession, log_id: int, user_id: int
) -> PracticeLog:
    """Fetch a practice log, verifying ownership and not deleted."""
    result = await session.exec(
        select(PracticeLog).where(
            PracticeLog.id == log_id,
            PracticeLog.user_id == user_id,
            PracticeLog.deleted_at == None,  # noqa: E711
        )
    )
    log = result.first()
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Practice log not found",
        )
    return log


async def _get_section_log_in_practice(
    session: AsyncSession, log_id: int, section_log_id: int, user_id: int
) -> SectionLog:
    """Fetch a section log, verifying it belongs to the user's practice log."""
    result = await session.exec(
        select(SectionLog)
        .join(PracticeLog, SectionLog.practice_log_id == PracticeLog.id)
        .where(
            SectionLog.id == section_log_id,
            SectionLog.practice_log_id == log_id,
            PracticeLog.user_id == user_id,
            PracticeLog.deleted_at == None,  # noqa: E711
        )
    )
    sl = result.first()
    if not sl:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Section log not found",
        )
    return sl


async def _get_block_log_in_practice(
    session: AsyncSession, log_id: int, block_log_id: int, user_id: int
) -> BlockLog:
    """Fetch a block log, verifying it belongs to the user's practice log."""
    result = await session.exec(
        select(BlockLog)
        .join(SectionLog, BlockLog.section_log_id == SectionLog.id)
        .join(PracticeLog, SectionLog.practice_log_id == PracticeLog.id)
        .where(
            BlockLog.id == block_log_id,
            PracticeLog.id == log_id,
            PracticeLog.user_id == user_id,
            PracticeLog.deleted_at == None,  # noqa: E711
        )
    )
    bl = result.first()
    if not bl:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Block log not found",
        )
    return bl


async def _build_log_read(
    session: AsyncSession,
    log: PracticeLog,
    last_tempo_map: dict[int, int] | None = None,
) -> PracticeLogRead:
    """Load a practice log with full nested section_logs → block_logs
    and denormalized names from relationships."""
    result = await session.exec(
        select(PracticeLog)
        .where(PracticeLog.id == log.id)
        .options(
            selectinload(PracticeLog.section_logs)  # type: ignore[arg-type]
            .selectinload(SectionLog.block_logs),  # type: ignore[arg-type]
            selectinload(PracticeLog.instrument),  # type: ignore[arg-type]
            selectinload(PracticeLog.template),  # type: ignore[arg-type]
            selectinload(PracticeLog.template_session),  # type: ignore[arg-type]
        )
    )
    loaded = result.one()

    sorted_sections = sorted(loaded.section_logs, key=lambda s: s.display_order)
    section_reads = []
    for sl in sorted_sections:
        sorted_blocks = sorted(sl.block_logs, key=lambda b: b.display_order)
        block_reads = []
        for bl in sorted_blocks:
            tempo = None
            if last_tempo_map and bl.block_id and bl.block_id in last_tempo_map:
                tempo = last_tempo_map[bl.block_id]
            block_reads.append(BlockLogRead(
                id=bl.id,
                block_id=bl.block_id,
                block_name=bl.block_name,
                rating=bl.rating,
                notes=bl.notes,
                completed=bl.completed,
                display_order=bl.display_order,
                last_tempo_bpm=tempo,
            ))
        section_reads.append(SectionLogRead(
            id=sl.id,
            section_id=sl.section_id,
            section_type=sl.section_type,
            section_name=sl.section_name,
            planned_duration_minutes=sl.planned_duration_minutes,
            actual_duration_minutes=sl.actual_duration_minutes,
            display_order=sl.display_order,
            completed=sl.completed,
            block_logs=block_reads,
        ))

    return PracticeLogRead(
        id=loaded.id,
        user_id=loaded.user_id,
        instrument_id=loaded.instrument_id,
        template_id=loaded.template_id,
        template_session_id=loaded.template_session_id,
        status=loaded.status,
        practice_date=loaded.practice_date,
        total_duration_minutes=loaded.total_duration_minutes,
        notes=loaded.notes,
        reflection_prompt=loaded.reflection_prompt,
        reflection_response=loaded.reflection_response,
        created_at=loaded.created_at,
        instrument_name=loaded.instrument.name if loaded.instrument else "",
        template_name=loaded.template.name if loaded.template else None,
        session_name=(
            loaded.template_session.name if loaded.template_session else None
        ),
        section_logs=section_reads,
    )


async def _lookup_last_tempos(
    session: AsyncSession, user_id: int, block_ids: list[int]
) -> dict[int, int]:
    """For each block_id, find the most recent BlockLog with a non-null
    tempo from a completed session. Returns {block_id: tempo_bpm}."""
    if not block_ids:
        return {}

    # Use a lateral join / correlated subquery to get the most recent
    # block log per block_id that has tempo data.
    # Simpler approach: query all recent block logs and deduplicate in Python.
    from sqlalchemy import func, and_

    # Get the max practice_log.created_at for each block_id where the
    # block was part of a completed session and has a non-null block_id
    result = await session.exec(
        select(
            BlockLog.block_id,
            Block.tempo_bpm,
        )
        .join(SectionLog, BlockLog.section_log_id == SectionLog.id)
        .join(PracticeLog, SectionLog.practice_log_id == PracticeLog.id)
        .join(Block, BlockLog.block_id == Block.id)
        .where(
            PracticeLog.user_id == user_id,
            PracticeLog.status == SessionStatus.completed.value,
            PracticeLog.deleted_at == None,  # noqa: E711
            BlockLog.block_id.in_(block_ids),  # type: ignore[union-attr]
            Block.tempo_bpm != None,  # noqa: E711
        )
        .order_by(col(PracticeLog.created_at).desc())
    )
    rows = result.all()

    # Deduplicate: first occurrence per block_id is the most recent
    tempo_map: dict[int, int] = {}
    for block_id, tempo_bpm in rows:
        if block_id not in tempo_map and tempo_bpm is not None:
            tempo_map[block_id] = tempo_bpm

    return tempo_map


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/practice/start",
    response_model=PracticeLogRead,
    status_code=status.HTTP_201_CREATED,
)
async def start_practice(
    body: PracticeStartRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Start a practice session.

    For template sessions: scaffolds SectionLogs and BlockLogs from the
    template session structure. For freeform: creates an empty log.
    """
    # Verify instrument ownership
    await get_owned_instrument(session, body.instrument_id, current_user.id)

    # If template-based, verify ownership and load the template session
    ts = None
    if body.template_id and body.template_session_id:
        # Verify template belongs to this user and instrument
        template = await get_owned_template(
            session, body.template_id, current_user.id
        )
        if template.instrument_id != body.instrument_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found",
            )

        result = await session.exec(
            select(TemplateSession)
            .where(
                TemplateSession.id == body.template_session_id,
                TemplateSession.template_id == body.template_id,
            )
            .options(
                selectinload(TemplateSession.sections)  # type: ignore[arg-type]
                .selectinload(Section.blocks)  # type: ignore[arg-type]
            )
        )
        ts = result.first()
        if not ts:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template session not found",
            )
    elif body.template_id or body.template_session_id:
        # One provided without the other — reject
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Both template_id and template_session_id must be provided together, or neither",
        )

    # Create the practice log
    log = PracticeLog(
        user_id=current_user.id,
        instrument_id=body.instrument_id,
        template_id=body.template_id,
        template_session_id=body.template_session_id,
        practice_date=datetime.now(timezone.utc).date(),
        status=SessionStatus.in_progress.value,
    )
    session.add(log)
    await session.flush()

    last_tempo_map: dict[int, int] = {}

    if ts is not None:
        # Collect all block_ids for smart tempo lookup
        all_block_ids = []
        for sec in ts.sections:
            for block in sec.blocks:
                if block.id is not None:
                    all_block_ids.append(block.id)

        last_tempo_map = await _lookup_last_tempos(
            session, current_user.id, all_block_ids
        )

        # Scaffold section logs and block logs
        for sec in sorted(ts.sections, key=lambda s: s.display_order):
            sl = SectionLog(
                practice_log_id=log.id,
                section_id=sec.id,
                section_type=sec.section_type,
                section_name=sec.name,
                planned_duration_minutes=sec.estimated_duration_minutes,
                actual_duration_minutes=sec.estimated_duration_minutes,
                display_order=sec.display_order,
            )
            session.add(sl)
            await session.flush()

            for block in sorted(sec.blocks, key=lambda b: b.display_order):
                bl = BlockLog(
                    section_log_id=sl.id,
                    block_id=block.id,
                    block_name=block.name,
                    display_order=block.display_order,
                    completed=False,
                )
                session.add(bl)

    await session.commit()
    await session.refresh(log)
    return await _build_log_read(session, log, last_tempo_map)


@router.get("/practice/{log_id}", response_model=PracticeLogRead)
async def get_practice(
    log_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get an in-progress or completed session with all section/block logs."""
    log = await _get_owned_log(session, log_id, current_user.id)
    return await _build_log_read(session, log)


@router.patch("/practice/{log_id}", response_model=PracticeLogRead)
async def update_practice(
    log_id: int,
    body: PracticeLogUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update session-level fields (notes) or set status to abandoned."""
    log = await _get_owned_log(session, log_id, current_user.id)

    update_data = body.model_dump(exclude_unset=True, mode="json")
    for field, value in update_data.items():
        setattr(log, field, value)

    session.add(log)
    await session.commit()
    await session.refresh(log)
    return await _build_log_read(session, log)


@router.put(
    "/practice/{log_id}/sections/{section_log_id}",
    response_model=SectionLogRead,
)
async def update_section_log(
    log_id: int,
    section_log_id: int,
    body: SectionLogUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update a section log. Supports mark_all_done and skip section."""
    sl = await _get_section_log_in_practice(
        session, log_id, section_log_id, current_user.id
    )

    update_data = body.model_dump(exclude_unset=True, mode="json")

    # Reject conflicting mark_all_done + skip
    if update_data.get("mark_all_done") is True and update_data.get("completed") is False:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cannot mark_all_done and skip the section in the same request",
        )

    # Handle mark_all_done: set completed=true on all child block logs
    if update_data.pop("mark_all_done", None) is True:
        result = await session.exec(
            select(BlockLog).where(BlockLog.section_log_id == sl.id)
        )
        for bl in result.all():
            bl.completed = True
            session.add(bl)

    # Handle skip section: cascade completed=false to all child block logs
    if update_data.get("completed") is False:
        result = await session.exec(
            select(BlockLog).where(BlockLog.section_log_id == sl.id)
        )
        for bl in result.all():
            bl.completed = False
            session.add(bl)

    for field, value in update_data.items():
        setattr(sl, field, value)

    session.add(sl)
    await session.commit()
    await session.refresh(sl)

    # Return with nested block logs
    result = await session.exec(
        select(SectionLog)
        .where(SectionLog.id == sl.id)
        .options(selectinload(SectionLog.block_logs))  # type: ignore[arg-type]
    )
    loaded = result.one()
    sorted_blocks = sorted(loaded.block_logs, key=lambda b: b.display_order)
    return SectionLogRead(
        id=loaded.id,
        section_id=loaded.section_id,
        section_type=loaded.section_type,
        section_name=loaded.section_name,
        planned_duration_minutes=loaded.planned_duration_minutes,
        actual_duration_minutes=loaded.actual_duration_minutes,
        display_order=loaded.display_order,
        completed=loaded.completed,
        block_logs=sorted_blocks,
    )


@router.put(
    "/practice/{log_id}/blocks/{block_log_id}",
    response_model=BlockLogRead,
)
async def update_block_log(
    log_id: int,
    block_log_id: int,
    body: BlockLogUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update a block log (rating, notes, completed)."""
    bl = await _get_block_log_in_practice(
        session, log_id, block_log_id, current_user.id
    )

    update_data = body.model_dump(exclude_unset=True, mode="json")
    for field, value in update_data.items():
        setattr(bl, field, value)

    session.add(bl)
    await session.commit()
    await session.refresh(bl)
    return bl
