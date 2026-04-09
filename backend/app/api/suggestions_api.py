"""
Suggestions API — coaching nudges for the Kantelo product.

Four endpoints:
- GET /suggestions/pre-session?instrument_id=X
- GET /suggestions/in-session/{logId}
- POST /suggestions/dismiss
- POST /suggestions/interact
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.database import get_session
from app.models import User, SuggestionDismissal, SuggestionInteraction
from app.auth import get_current_user
from app.api.ownership import get_owned_instrument
from app.schemas.suggestion import (
    InSessionResponse,
    InSessionSuggestion,
    PreSessionResponse,
    SuggestionDismissRequest,
    SuggestionInteractionCreate,
    SuggestionInteractionRead,
    SuggestionItem,
)
from app.suggestions import (
    evaluate_pre_session,
    evaluate_in_session,
)
from app.api.practice_api import _get_owned_log

router = APIRouter(prefix="/suggestions", tags=["suggestions"])


@router.get("/pre-session", response_model=PreSessionResponse)
async def get_pre_session_suggestion(
    instrument_id: int = Query(...),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Return at most one pre-session suggestion for the Today tab."""
    instrument = await get_owned_instrument(
        session, instrument_id, current_user.id
    )
    suggestion = await evaluate_pre_session(
        session, current_user.id, instrument.id
    )
    if suggestion is None:
        return PreSessionResponse(suggestion=None)
    return PreSessionResponse(
        suggestion=SuggestionItem(
            rule_id=suggestion.rule_id,
            tier=suggestion.tier.value,
            text=suggestion.text,
        )
    )


@router.get("/in-session/{log_id}", response_model=InSessionResponse)
async def get_in_session_suggestions(
    log_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Return in-the-moment suggestions keyed by block_log_id for an
    active practice session."""
    # Verify ownership of the log
    await _get_owned_log(session, log_id, current_user.id)

    suggestions_by_bl = await evaluate_in_session(
        session, current_user.id, log_id
    )
    return InSessionResponse(
        suggestions={
            str(bl_id): InSessionSuggestion(
                rule_id=s.rule_id,
                text=s.text,
            )
            for bl_id, s in suggestions_by_bl.items()
        }
    )


@router.post("/dismiss", status_code=status.HTTP_204_NO_CONTENT)
async def dismiss_suggestion(
    body: SuggestionDismissRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Dismiss a suggestion rule for this user (and optionally for a
    specific instrument). Idempotent — a duplicate dismiss is a no-op."""
    if body.instrument_id is not None:
        await get_owned_instrument(
            session, body.instrument_id, current_user.id
        )

    # Check for an existing dismissal (idempotency)
    existing_query = select(SuggestionDismissal).where(
        SuggestionDismissal.user_id == current_user.id,
        SuggestionDismissal.suggestion_rule_id == body.rule_id,
    )
    if body.instrument_id is not None:
        existing_query = existing_query.where(
            SuggestionDismissal.instrument_id == body.instrument_id
        )
    else:
        existing_query = existing_query.where(
            SuggestionDismissal.instrument_id == None  # noqa: E711
        )
    result = await session.exec(existing_query)
    if result.first() is not None:
        return  # already dismissed

    dismissal = SuggestionDismissal(
        user_id=current_user.id,
        instrument_id=body.instrument_id,
        suggestion_rule_id=body.rule_id,
        suggestion_tier=body.tier.value,
    )
    session.add(dismissal)
    await session.commit()


@router.post(
    "/interact",
    response_model=SuggestionInteractionRead,
    status_code=status.HTTP_201_CREATED,
)
async def record_suggestion_interaction(
    body: SuggestionInteractionCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Log a suggestion interaction for analytics (shown / dismissed / acted_on)."""
    if body.instrument_id is not None:
        await get_owned_instrument(
            session, body.instrument_id, current_user.id
        )

    interaction = SuggestionInteraction(
        user_id=current_user.id,
        instrument_id=body.instrument_id,
        suggestion_rule_id=body.suggestion_rule_id,
        suggestion_tier=body.suggestion_tier.value,
        suggestion_text=body.suggestion_text,
        interaction_type=body.interaction_type.value,
    )
    session.add(interaction)
    await session.commit()
    await session.refresh(interaction)
    return interaction
