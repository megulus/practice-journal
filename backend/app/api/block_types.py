from fastapi import APIRouter, Depends
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import List

from app.database import get_session
from app.models import BlockType, User
from app.auth import get_current_user

router = APIRouter(prefix="/block-types", tags=["block-types"])


@router.get("/", response_model=List[BlockType])
async def list_block_types(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get all block types (system + user-owned), ordered by display_order."""
    statement = (
        select(BlockType)
        .where(
            (BlockType.is_system == True) | (BlockType.user_id == current_user.id)
        )
        .order_by(BlockType.display_order)
    )
    result = await session.exec(statement)
    return result.all()
