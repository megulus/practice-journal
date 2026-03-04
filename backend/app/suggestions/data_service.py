from datetime import date, timedelta
from typing import Optional
from collections import Counter

from sqlmodel import select, and_, or_, col
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import func

from app.models import (
    PracticeLog,
    PracticeLogDetail,
    PracticeTemplate,
    UserInstrument,
    BlockType,
)
from app.suggestions.models import PracticeStats


class PracticeDataService:
    def __init__(
        self,
        session: AsyncSession,
        user_id: int,
        instrument_id: Optional[int] = None,
    ):
        self.session = session
        self.user_id = user_id
        self.instrument_id = instrument_id

    async def _get_template_ids(self) -> list[int]:
        """Get template IDs for the user, optionally filtered by instrument."""
        query = select(PracticeTemplate.id).where(
            PracticeTemplate.user_id == self.user_id,
            PracticeTemplate.deleted_at == None,
        )
        if self.instrument_id is not None:
            # User templates via user_instrument, or system template copies with instrument_id
            ui_query = select(UserInstrument.id).where(
                UserInstrument.user_id == self.user_id,
                UserInstrument.instrument_id == self.instrument_id,
            )
            ui_result = await self.session.exec(ui_query)
            ui_ids = ui_result.all()

            query = query.where(
                or_(
                    PracticeTemplate.user_instrument_id.in_(ui_ids),  # type: ignore[union-attr]
                    PracticeTemplate.instrument_id == self.instrument_id,
                )
            )

        result = await self.session.exec(query)
        return list(result.all())

    async def _get_recent_logs(
        self, template_ids: list[int], days: int = 30
    ) -> list[PracticeLog]:
        """Get practice logs from the last N days, eager-loading details."""
        cutoff = date.today() - timedelta(days=days)
        query = (
            select(PracticeLog)
            .options(selectinload(PracticeLog.log_details))  # type: ignore[arg-type]
            .where(
                PracticeLog.user_id == self.user_id,
                PracticeLog.deleted_at == None,
                PracticeLog.practice_date >= cutoff,
            )
        )
        if template_ids:
            query = query.where(
                PracticeLog.template_id.in_(template_ids)  # type: ignore[union-attr]
            )
        query = query.order_by(PracticeLog.practice_date.desc())  # type: ignore[union-attr]
        result = await self.session.exec(query)
        return list(result.all())

    async def _get_all_known_section_types(self) -> list[str]:
        """Union of system BlockType slugs + distinct section_types from user's history."""
        # System block types
        bt_query = select(BlockType.slug).where(BlockType.is_system == True)
        bt_result = await self.session.exec(bt_query)
        system_slugs = set(bt_result.all())

        # User's historical section types
        detail_query = (
            select(PracticeLogDetail.section_type)
            .join(PracticeLog, PracticeLogDetail.log_id == PracticeLog.id)
            .where(
                PracticeLog.user_id == self.user_id,
                PracticeLog.deleted_at == None,
            )
            .distinct()
        )
        detail_result = await self.session.exec(detail_query)
        user_types = set(detail_result.all())

        return sorted(system_slugs | user_types)

    async def get_stats(self) -> PracticeStats:
        """Compute all practice statistics for the rules engine."""
        template_ids = await self._get_template_ids()
        logs = await self._get_recent_logs(template_ids, days=30)
        all_known = await self._get_all_known_section_types()

        today = date.today()

        # days_since_last_practice
        days_since = None
        if logs:
            most_recent = max(log.practice_date for log in logs)
            days_since = (today - most_recent).days

        # days_practiced_last_7_days
        seven_days_ago = today - timedelta(days=7)
        days_7 = len(
            {log.practice_date for log in logs if log.practice_date >= seven_days_ago}
        )

        # section_type_distribution (% of total time per section type)
        section_minutes: Counter[str] = Counter()
        for log in logs:
            for detail in log.log_details:
                if detail.duration_minutes and detail.duration_minutes > 0:
                    section_minutes[detail.section_type] += detail.duration_minutes
                else:
                    # Fall back: equal weight (1 minute) if no duration recorded
                    section_minutes[detail.section_type] += 1

        total_section_minutes = sum(section_minutes.values())
        distribution: dict[str, float] = {}
        if total_section_minutes > 0:
            distribution = {
                st: round(mins / total_section_minutes, 3)
                for st, mins in section_minutes.items()
            }

        # average_duration_last_10 / overall
        durations = [log.duration_minutes for log in logs if log.duration_minutes > 0]
        avg_overall = sum(durations) / len(durations) if durations else None
        avg_last_10 = (
            sum(durations[:10]) / len(durations[:10])
            if durations
            else None
        )

        # section_types_last_14_days
        fourteen_days_ago = today - timedelta(days=14)
        recent_logs_14 = [
            log for log in logs if log.practice_date >= fourteen_days_ago
        ]
        types_14: set[str] = set()
        for log in recent_logs_14:
            for detail in log.log_details:
                types_14.add(detail.section_type)

        # recent_sessions_with_warmup (of last 10 sessions)
        last_10 = logs[:10]
        warmup_count = 0
        for log in last_10:
            section_types_in_log = {d.section_type for d in log.log_details}
            if "warmup" in section_types_in_log or "warm-up" in section_types_in_log:
                warmup_count += 1

        return PracticeStats(
            user_id=self.user_id,
            instrument_id=self.instrument_id,
            days_since_last_practice=days_since,
            total_sessions_last_30_days=len(logs),
            days_practiced_last_7_days=days_7,
            section_type_distribution=distribution,
            average_duration_last_10=avg_last_10,
            average_duration_overall=avg_overall,
            all_known_section_types=all_known,
            section_types_last_14_days=sorted(types_14),
            recent_sessions_with_warmup=warmup_count,
            recent_sessions_total=len(last_10),
        )
