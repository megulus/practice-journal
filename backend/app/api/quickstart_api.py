"""
Quick-start API — one call turns the wizard's answers into a ready plan.

The wizard (product spec §5.6) has to leave the user with an instrument, an
active plan, and optionally a first repertoire piece. Doing that through the
individual CRUD endpoints is ~15 round trips that can half-fail; this commits
the lot in a single transaction instead.
"""
from fastapi import APIRouter, Depends, Response, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.idempotency import IdempotentRequest, idempotency_key
from app.api.ownership import get_owned_instrument
from app.api.instruments_api import _enrich_instrument
from app.api.templates_api import _build_template_read, _get_or_create_settings
from app.auth import get_current_user
from app.database import get_session
from app.enums import SectionType
from app.models import Block, Instrument, Piece, Section, Template, TemplateSession, User
from app.schemas.piece import PieceRead
from app.schemas.quickstart import QuickStartRequest, QuickStartResponse

router = APIRouter(prefix="/quickstart", tags=["quickstart"])

#: What an idempotency key is spent on here (see app/api/idempotency.py).
ENDPOINT = "POST /api/quickstart"


@router.post("", response_model=QuickStartResponse, status_code=status.HTTP_201_CREATED)
async def quick_start(
    body: QuickStartRequest,
    response: Response,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    key: str | None = Depends(idempotency_key),
):
    """Create everything the quick-start wizard collected, in one transaction.

    Creates (or reuses) the instrument, optionally a first piece, and an active
    single-session plan whose sections each hold one seed block. A section of
    type `repertoire` gets a repertoire block pointing at the new piece when
    one was named, and a plain block otherwise.

    The chosen time budget (the sum of the section durations) also becomes the
    user's `default_session_duration_minutes`, so later plans start there.

    Send an `Idempotency-Key` header to make a retry safe: if the first attempt
    committed but its response was lost in flight, the retry replays that
    response instead of creating a second instrument, piece and plan (#290).
    """
    # Claimed before any writes, so a duplicate that arrives while this one is
    # still running waits on the key rather than racing it.
    idem = await IdempotentRequest.open(
        session,
        user_id=current_user.id,
        endpoint=ENDPOINT,
        key=key,
        body=body,
    )
    if idem.replay is not None:
        return idem.respond(response)

    # --- instrument: reuse or create -------------------------------------
    if body.instrument_id is not None:
        instrument = await get_owned_instrument(
            session, body.instrument_id, current_user.id
        )
    else:
        instrument = Instrument(user_id=current_user.id, name=body.instrument_name)
        session.add(instrument)
        await session.flush()

    # --- first repertoire piece (optional) -------------------------------
    piece: Piece | None = None
    if body.piece_name:
        piece = Piece(instrument_id=instrument.id, name=body.piece_name)
        session.add(piece)
        await session.flush()

    # --- plan ------------------------------------------------------------
    # Only one active template per instrument (partial unique index); stand
    # the old one down before the new one lands.
    result = await session.exec(
        select(Template).where(
            Template.instrument_id == instrument.id,
            Template.user_id == current_user.id,
            Template.is_active == True,  # noqa: E712
            Template.deleted_at == None,  # noqa: E711
        )
    )
    current_active = result.first()
    if current_active:
        current_active.is_active = False
        session.add(current_active)
        await session.flush()

    template = Template(
        user_id=current_user.id,
        instrument_id=instrument.id,
        name=body.plan_name,
        is_active=True,
    )
    session.add(template)
    await session.flush()

    template_session = TemplateSession(
        template_id=template.id,
        name="Session 1",
        display_order=0,
    )
    session.add(template_session)
    await session.flush()

    for order, spec in enumerate(body.sections):
        section = Section(
            template_session_id=template_session.id,
            name=spec.name,
            section_type=spec.section_type.value,
            estimated_duration_minutes=spec.estimated_duration_minutes,
            display_order=order,
        )
        session.add(section)
        await session.flush()

        is_repertoire = spec.section_type == SectionType.repertoire and piece is not None
        session.add(
            Block(
                section_id=section.id,
                # A repertoire block takes its display name from the piece.
                name=None if is_repertoire else spec.block.name,
                piece_id=piece.id if is_repertoire else None,
                description=spec.block.description,
                estimated_duration_minutes=spec.estimated_duration_minutes,
                display_order=0,
            )
        )

    # --- remember the time budget ----------------------------------------
    settings = await _get_or_create_settings(session, current_user.id)
    settings.default_session_duration_minutes = sum(
        s.estimated_duration_minutes for s in body.sections
    )
    session.add(settings)
    await session.flush()

    # Built before the commit so the stored copy an idempotent retry replays
    # is the same object this caller gets, written in the same transaction.
    payload = QuickStartResponse(
        instrument=await _enrich_instrument(session, instrument),
        template=await _build_template_read(session, template),
        template_session_id=template_session.id,
        piece=PieceRead.model_validate(piece) if piece else None,
    )
    idem.store(payload, status_code=status.HTTP_201_CREATED)

    # Through the guard, not session.commit(): it won't let a reservation the
    # response was never stored into reach the database.
    await idem.commit()
    return payload
