"""
Practice session lifecycle API.

Start, read, update, and finish practice sessions. Handles scaffolding
from templates, smart tempo defaults, section-level actions, freeform
additions, session finishing with summary stats, and reflection prompts.
"""
from typing import List
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select, col
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import selectinload

from sqlalchemy import func

from app.database import get_session
from app.models import (
    User,
    UserSettings,
    Instrument,
    Template,
    TemplateSession,
    Section,
    Block,
    Piece,
    Spot,
    TemplateBlockSpot,
    PracticeLog,
    SectionLog,
    BlockLog,
)
from app.auth import get_current_user
from app.api.ownership import get_owned_instrument, get_owned_template
from app.enums import SessionStatus, utcnow
from app.schemas.practice import (
    AddSpotRequest,
    BlockLogCreate,
    BlockLogRead,
    BlockLogUpdate,
    CollapseToPieceRequest,
    FinishResponse,
    PracticeLogRead,
    PracticeLogUpdate,
    PracticeStartRequest,
    ReflectionUpdate,
    SectionLogCreate,
    SectionLogRead,
    SectionLogUpdate,
)
from app.services.practice_service import (
    calculate_day_streak,
    compute_session_summary,
    select_reflection_prompt,
)
from app.suggestions import evaluate_post_session
from app.schemas.practice import CoachingSuggestion

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


def _require_status(log: PracticeLog, expected: str, action: str) -> None:
    """Raise 409 Conflict if the log is not in the expected status."""
    if log.status != expected:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot {action}: session is {log.status}",
        )


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
                spot_id=bl.spot_id,
                block_name=bl.block_name,
                rating=bl.rating,
                notes=bl.notes,
                completed=bl.completed,
                display_order=bl.display_order,
                tempo_bpm=bl.tempo_bpm,
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
            skipped=sl.skipped,
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
    """For each block_id, find the tempo to pre-fill from a completed session.

    Prefers the most recently *logged* tempo (BlockLog.tempo_bpm, set when the
    user confirms or adjusts the tempo field mid-session) and falls back to the
    template block's own tempo. Returns {block_id: tempo_bpm}.
    """
    if not block_ids:
        return {}

    # Query all recent block logs and deduplicate in Python.
    # Get the max practice_log.created_at for each block_id where the
    # block was part of a completed session and has a non-null block_id
    result = await session.exec(
        select(
            BlockLog.block_id,
            BlockLog.tempo_bpm,
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
        )
        .order_by(col(PracticeLog.created_at).desc())
    )
    rows = result.all()

    # Deduplicate: first occurrence per block_id is the most recent
    logged: dict[int, int] = {}
    from_template: dict[int, int] = {}
    for block_id, logged_tempo, template_tempo in rows:
        if logged_tempo is not None and block_id not in logged:
            logged[block_id] = logged_tempo
        if template_tempo is not None and block_id not in from_template:
            from_template[block_id] = template_tempo

    return {**from_template, **logged}


async def _lookup_last_tempos_for_log(
    session: AsyncSession, user_id: int, log_id: int
) -> dict[int, int]:
    """Smart tempo defaults for an already-scaffolded log, so a reload of an
    in-progress session pre-fills the same values `start` returned."""
    result = await session.exec(
        select(BlockLog.block_id)
        .join(SectionLog, BlockLog.section_log_id == SectionLog.id)
        .where(
            SectionLog.practice_log_id == log_id,
            BlockLog.block_id != None,  # noqa: E711
        )
    )
    block_ids = [bid for bid in result.all() if bid is not None]
    return await _lookup_last_tempos(session, user_id, block_ids)


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
                .selectinload(Block.template_block_spots)  # type: ignore[arg-type]
                .selectinload(TemplateBlockSpot.spot),  # type: ignore[arg-type]
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

            # Track display_order with a running counter so repertoire
            # blocks that expand to multiple spots get sequential orders.
            bl_order = 0
            for block in sorted(sec.blocks, key=lambda b: b.display_order):
                if block.piece_id is not None:
                    # Repertoire block — expand into per-spot BlockLogs
                    piece_result = await session.exec(
                        select(Piece.name).where(Piece.id == block.piece_id)
                    )
                    piece_name = piece_result.one()

                    active_spots = sorted(
                        [
                            tbs for tbs in block.template_block_spots
                            if tbs.spot is not None
                            and tbs.spot.deleted_at is None
                            and tbs.spot.retired_at is None
                        ],
                        key=lambda tbs: tbs.display_order,
                    )
                    if active_spots:
                        for tbs in active_spots:
                            bl = BlockLog(
                                section_log_id=sl.id,
                                block_id=block.id,
                                spot_id=tbs.spot.id,
                                block_name=f"{piece_name} \u2014 {tbs.spot.name}",
                                display_order=bl_order,
                                completed=False,
                            )
                            session.add(bl)
                            bl_order += 1
                    else:
                        # Zero default spots — placeholder piece-level log
                        bl = BlockLog(
                            section_log_id=sl.id,
                            block_id=block.id,
                            block_name=piece_name,
                            display_order=bl_order,
                            completed=False,
                        )
                        session.add(bl)
                        bl_order += 1
                else:
                    # Standard block
                    bl = BlockLog(
                        section_log_id=sl.id,
                        block_id=block.id,
                        block_name=block.name,
                        display_order=bl_order,
                        completed=False,
                    )
                    session.add(bl)
                    bl_order += 1

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
    last_tempo_map = await _lookup_last_tempos_for_log(
        session, current_user.id, log_id
    )
    return await _build_log_read(session, log, last_tempo_map)


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
    """Update a section log. Supports mark_all_done and skip section.

    No status guard: editing after completion is allowed (spec's
    "Edit this session" button on the summary screen).
    """
    sl = await _get_section_log_in_practice(
        session, log_id, section_log_id, current_user.id
    )

    update_data = body.model_dump(exclude_unset=True, mode="json")

    # Reject conflicting mark_all_done + skip
    if update_data.get("mark_all_done") is True and update_data.get("skipped") is True:
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

    # Skip is lossless: `skipped` is a plain field set by the loop below, and
    # it deliberately does NOT touch block completion or ratings, so unskipping
    # restores the section exactly.
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
        skipped=loaded.skipped,
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
    """Update a block log (rating, notes, completed, tempo_bpm).

    No status guard: editing after completion is allowed (spec's
    "Edit this session" button on the summary screen).
    """
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


# ---------------------------------------------------------------------------
# Finish, reflection, freeform additions
# ---------------------------------------------------------------------------

@router.post(
    "/practice/{log_id}/finish",
    response_model=FinishResponse,
)
async def finish_practice(
    log_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Finish a practice session.

    Sums section durations, sets status to completed, advances rotation
    index on the template, picks a reflection prompt, generates a
    coaching suggestion, and returns full summary stats.
    """
    log = await _get_owned_log(session, log_id, current_user.id)
    _require_status(log, SessionStatus.in_progress.value, "finish")

    # Eagerly load section_logs with block_logs
    result = await session.exec(
        select(PracticeLog)
        .where(PracticeLog.id == log.id)
        .options(
            selectinload(PracticeLog.section_logs)  # type: ignore[arg-type]
            .selectinload(SectionLog.block_logs),  # type: ignore[arg-type]
        )
    )
    loaded = result.one()

    # Sum durations and complete
    total = sum(sl.actual_duration_minutes for sl in loaded.section_logs)
    log.total_duration_minutes = total
    log.status = SessionStatus.completed.value

    # Compute summary before commit — async session expires loaded
    # objects after commit, making lazy access impossible
    pre_summary = compute_session_summary(loaded.section_logs, day_streak=0)

    # Advance rotation index on the template (if template-based)
    if log.template_id is not None:
        tmpl_result = await session.exec(
            select(Template).where(Template.id == log.template_id)
        )
        tmpl = tmpl_result.first()
        if tmpl:
            session_count_result = await session.exec(
                select(func.count()).where(
                    TemplateSession.template_id == tmpl.id
                )
            )
            session_count = session_count_result.one()
            if session_count > 0:
                tmpl.current_rotation_index = (
                    (tmpl.current_rotation_index + 1) % session_count
                )
                session.add(tmpl)

    # Pick reflection prompt
    prompt = await select_reflection_prompt(session, current_user.id)
    log.reflection_prompt = prompt

    session.add(log)
    await session.commit()
    await session.refresh(log)

    # Post-commit: streak needs this session counted
    streak = await calculate_day_streak(session, current_user.id)
    # Patch in the streak (computed after commit so this session counts)
    summary = pre_summary.model_copy(update={"day_streak": streak})

    # Evaluate post-session suggestion via the new engine. The engine handles
    # the suggestions_preference and dismissal filtering internally.
    raw_suggestion = await evaluate_post_session(
        session, current_user.id, log.instrument_id, log.id
    )
    suggestion = (
        CoachingSuggestion(text=raw_suggestion.text, rule_id=raw_suggestion.rule_id)
        if raw_suggestion is not None
        else None
    )

    # Re-load with nested data for response
    log_read = await _build_log_read(session, log)

    return FinishResponse(
        practice_log=log_read,
        summary=summary,
        coaching_suggestion=suggestion,
        reflection_prompt=prompt,
    )


@router.patch(
    "/practice/{log_id}/reflection",
    response_model=PracticeLogRead,
)
async def save_reflection(
    log_id: int,
    body: ReflectionUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Save the reflection response on a completed session."""
    log = await _get_owned_log(session, log_id, current_user.id)
    _require_status(log, SessionStatus.completed.value, "save reflection")

    log.reflection_response = body.reflection_response
    session.add(log)
    await session.commit()
    await session.refresh(log)
    return await _build_log_read(session, log)


@router.post(
    "/practice/{log_id}/sections",
    response_model=SectionLogRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_freeform_section(
    log_id: int,
    body: SectionLogCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Add a freeform section to an in-progress session."""
    log = await _get_owned_log(session, log_id, current_user.id)
    _require_status(log, SessionStatus.in_progress.value, "add section")

    # Determine next display_order
    max_order_result = await session.exec(
        select(func.max(SectionLog.display_order)).where(
            SectionLog.practice_log_id == log.id
        )
    )
    max_order = max_order_result.one()
    next_order = (max_order + 1) if max_order is not None else 0

    sl = SectionLog(
        practice_log_id=log.id,
        section_id=None,
        section_type=body.section_type.value,
        section_name=body.section_name,
        planned_duration_minutes=None,
        actual_duration_minutes=0,
        display_order=next_order,
        completed=True,
    )
    session.add(sl)
    await session.commit()
    await session.refresh(sl)

    return SectionLogRead(
        id=sl.id,
        section_id=sl.section_id,
        section_type=sl.section_type,
        section_name=sl.section_name,
        planned_duration_minutes=sl.planned_duration_minutes,
        actual_duration_minutes=sl.actual_duration_minutes,
        display_order=sl.display_order,
        completed=sl.completed,
        skipped=sl.skipped,
        block_logs=[],
    )


@router.post(
    "/practice/{log_id}/sections/{section_log_id}/blocks",
    response_model=BlockLogRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_freeform_block(
    log_id: int,
    section_log_id: int,
    body: BlockLogCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Add a freeform block to a section in an in-progress session."""
    log = await _get_owned_log(session, log_id, current_user.id)
    _require_status(log, SessionStatus.in_progress.value, "add block")

    sl = await _get_section_log_in_practice(
        session, log_id, section_log_id, current_user.id
    )

    # Determine next display_order
    max_order_result = await session.exec(
        select(func.max(BlockLog.display_order)).where(
            BlockLog.section_log_id == sl.id
        )
    )
    max_order = max_order_result.one()
    next_order = (max_order + 1) if max_order is not None else 0

    bl = BlockLog(
        section_log_id=sl.id,
        block_id=None,
        block_name=body.block_name,
        display_order=next_order,
        completed=False,
    )
    session.add(bl)
    await session.commit()
    await session.refresh(bl)
    return bl


# ---------------------------------------------------------------------------
# Repertoire: add spot mid-session, collapse/expand
# ---------------------------------------------------------------------------

@router.post(
    "/practice/{log_id}/blocks/{block_log_id}/spots",
    response_model=BlockLogRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_spot_mid_session(
    log_id: int,
    block_log_id: int,
    body: AddSpotRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create a new spot on the parent piece and add a BlockLog for it.

    The block_log_id identifies a repertoire block log in the current
    session. The new spot is created on the block's piece, and a new
    BlockLog is added to the same section log.

    If add_to_rotation is true (default), the spot is also added to the
    source template block's default spot list.
    """
    log = await _get_owned_log(session, log_id, current_user.id)
    _require_status(log, SessionStatus.in_progress.value, "add spot")

    bl = await _get_block_log_in_practice(
        session, log_id, block_log_id, current_user.id
    )

    # Resolve the block and verify it's a repertoire block
    if bl.block_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot add spots to a freeform block",
        )
    result = await session.exec(
        select(Block).where(Block.id == bl.block_id)
    )
    block = result.first()
    if not block or block.piece_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Block is not a repertoire block",
        )

    # Create the spot on the piece
    result = await session.exec(
        select(func.coalesce(func.max(Spot.display_order), -1)).where(
            Spot.piece_id == block.piece_id,
            Spot.deleted_at == None,  # noqa: E711
        )
    )
    max_order = result.one()

    spot = Spot(
        piece_id=block.piece_id,
        name=body.name,
        location=body.location,
        display_order=max_order + 1,
    )
    session.add(spot)
    await session.flush()

    # Add to template rotation if requested
    if body.add_to_rotation and block.id is not None:
        result = await session.exec(
            select(func.coalesce(
                func.max(TemplateBlockSpot.display_order), -1
            )).where(TemplateBlockSpot.block_id == block.id)
        )
        tbs_max = result.one()
        tbs = TemplateBlockSpot(
            block_id=block.id,
            spot_id=spot.id,
            display_order=tbs_max + 1,
        )
        session.add(tbs)

    # Get piece name for denormalization
    result = await session.exec(
        select(Piece.name).where(Piece.id == block.piece_id)
    )
    piece_name = result.one()

    # Create BlockLog for the new spot in this session
    max_order_result = await session.exec(
        select(func.max(BlockLog.display_order)).where(
            BlockLog.section_log_id == bl.section_log_id
        )
    )
    max_bl_order = max_order_result.one()
    next_order = (max_bl_order + 1) if max_bl_order is not None else 0

    new_bl = BlockLog(
        section_log_id=bl.section_log_id,
        block_id=block.id,
        spot_id=spot.id,
        block_name=f"{piece_name} \u2014 {spot.name}",
        display_order=next_order,
        completed=False,
    )
    session.add(new_bl)
    await session.commit()
    await session.refresh(new_bl)
    return new_bl


@router.put(
    "/practice/{log_id}/blocks/{block_log_id}/collapse-to-piece",
    response_model=BlockLogRead,
)
async def collapse_to_piece(
    log_id: int,
    block_log_id: int,
    body: CollapseToPieceRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Collapse per-spot logs of a repertoire block into a single piece-level log.

    Deletes all BlockLogs for this block_id in this session's section log,
    then creates one BlockLog with spot_id=null and block_name=piece name.
    """
    log = await _get_owned_log(session, log_id, current_user.id)
    _require_status(log, SessionStatus.in_progress.value, "collapse to piece")

    bl = await _get_block_log_in_practice(
        session, log_id, block_log_id, current_user.id
    )

    if bl.block_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot collapse a freeform block",
        )
    result = await session.exec(
        select(Block).where(Block.id == bl.block_id)
    )
    block = result.first()
    if not block or block.piece_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Block is not a repertoire block",
        )

    # Get piece name
    result = await session.exec(
        select(Piece.name).where(Piece.id == block.piece_id)
    )
    piece_name = result.one()

    # Capture values before deleting (access after delete is fragile)
    section_log_id = bl.section_log_id
    base_order = bl.display_order

    # Delete all BlockLogs for this block in this section log
    result = await session.exec(
        select(BlockLog).where(
            BlockLog.section_log_id == section_log_id,
            BlockLog.block_id == block.id,
        )
    )
    for old_bl in result.all():
        await session.delete(old_bl)

    # Create a single piece-level log
    new_bl = BlockLog(
        section_log_id=section_log_id,
        block_id=block.id,
        spot_id=None,
        block_name=piece_name,
        display_order=base_order,
        completed=body.rating is not None,
        rating=body.rating,
        notes=body.notes,
    )
    session.add(new_bl)
    await session.commit()
    await session.refresh(new_bl)
    return new_bl


@router.put(
    "/practice/{log_id}/blocks/{block_log_id}/expand-to-spots",
    response_model=List[BlockLogRead],
)
async def expand_to_spots(
    log_id: int,
    block_log_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Expand a piece-level log back into per-spot BlockLogs.

    Restores per-spot BlockLogs from the template block's default spot list.
    The collapsed piece-level log is deleted.
    """
    log = await _get_owned_log(session, log_id, current_user.id)
    _require_status(log, SessionStatus.in_progress.value, "expand to spots")

    bl = await _get_block_log_in_practice(
        session, log_id, block_log_id, current_user.id
    )

    if bl.block_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot expand a freeform block",
        )
    result = await session.exec(
        select(Block).where(Block.id == bl.block_id)
    )
    block = result.first()
    if not block or block.piece_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Block is not a repertoire block",
        )

    # Get piece name and default spots
    result = await session.exec(
        select(Piece.name).where(Piece.id == block.piece_id)
    )
    piece_name = result.one()

    result = await session.exec(
        select(TemplateBlockSpot)
        .where(TemplateBlockSpot.block_id == block.id)
        .options(selectinload(TemplateBlockSpot.spot))  # type: ignore[arg-type]
    )
    tbs_list = sorted(result.all(), key=lambda t: t.display_order)

    active_spots = [
        tbs for tbs in tbs_list
        if tbs.spot is not None
        and tbs.spot.deleted_at is None
        and tbs.spot.retired_at is None
    ]

    if not active_spots:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active default spots to expand to",
        )

    # Capture values before deleting (access after delete is fragile)
    section_log_id = bl.section_log_id
    base_order = bl.display_order
    await session.delete(bl)

    # Create per-spot logs with sequential display_orders
    new_logs = []
    for i, tbs in enumerate(active_spots):
        new_bl = BlockLog(
            section_log_id=section_log_id,
            block_id=block.id,
            spot_id=tbs.spot.id,
            block_name=f"{piece_name} \u2014 {tbs.spot.name}",
            display_order=base_order + i,
            completed=False,
        )
        session.add(new_bl)
        new_logs.append(new_bl)

    await session.commit()
    for nl in new_logs:
        await session.refresh(nl)

    return new_logs
