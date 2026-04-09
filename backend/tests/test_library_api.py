"""Tests for /api/library endpoints (curated blocks, recently used, repertoire)."""
import pytest
from datetime import date
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import (
    Instrument, Template, TemplateSession, Section, Block,
    CuratedBlock, Piece, Spot, PracticeLog, SectionLog, BlockLog,
)
from app.enums import utcnow


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _make_curated(
    db_session, name, instrument="violin", section_type="scales",
    usage_count=0, duration=5,
):
    cb = CuratedBlock(
        instrument_category=instrument,
        name=name,
        section_type=section_type,
        default_duration_minutes=duration,
        usage_count=usage_count,
    )
    db_session.add(cb)
    await db_session.commit()
    await db_session.refresh(cb)
    return cb


async def _make_practice_log_with_blocks(
    db_session, user, instrument, blocks, status="completed",
    practice_date=None,
):
    """Create a completed practice log with arbitrary block_logs.

    `blocks` is a list of dicts: {block_name, block_id, spot_id (optional)}
    """
    log = PracticeLog(
        user_id=user.id,
        instrument_id=instrument.id,
        status=status,
        practice_date=practice_date or date(2026, 4, 1),
        total_duration_minutes=30,
    )
    db_session.add(log)
    await db_session.commit()
    await db_session.refresh(log)

    sl = SectionLog(
        practice_log_id=log.id,
        section_type="scales",
        section_name="Scales",
        actual_duration_minutes=30,
    )
    db_session.add(sl)
    await db_session.commit()
    await db_session.refresh(sl)

    for i, b in enumerate(blocks):
        bl = BlockLog(
            section_log_id=sl.id,
            block_id=b.get("block_id"),
            spot_id=b.get("spot_id"),
            block_name=b["block_name"],
            display_order=i,
            completed=True,
            rating=1,
        )
        db_session.add(bl)
    await db_session.commit()
    return log


# ===================================================================
# BROWSE CURATED BLOCKS
# ===================================================================

class TestBrowseCuratedBlocks:
    async def test_filter_by_instrument(
        self, client: AsyncClient, db_session
    ):
        await _make_curated(db_session, "G major scale", instrument="violin")
        await _make_curated(db_session, "Hanon #1", instrument="piano")

        resp = await client.get("/api/library/blocks?instrument=violin")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "G major scale"

    async def test_filter_by_section_type(
        self, client: AsyncClient, db_session
    ):
        await _make_curated(db_session, "G major scale", section_type="scales")
        await _make_curated(
            db_session, "Open strings", section_type="warmup"
        )

        resp = await client.get(
            "/api/library/blocks?instrument=violin&section_type=warmup"
        )
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "Open strings"

    async def test_search_query(self, client: AsyncClient, db_session):
        await _make_curated(db_session, "G major scale, 3 octaves")
        await _make_curated(db_session, "D minor arpeggio")
        await _make_curated(db_session, "Open strings")

        resp = await client.get("/api/library/blocks?instrument=violin&q=scale")
        data = resp.json()
        assert len(data) == 1
        assert "scale" in data[0]["name"].lower()

    async def test_sorted_by_usage_count_desc(
        self, client: AsyncClient, db_session
    ):
        await _make_curated(db_session, "Low usage", usage_count=5)
        await _make_curated(db_session, "High usage", usage_count=200)
        await _make_curated(db_session, "Mid usage", usage_count=50)

        resp = await client.get("/api/library/blocks?instrument=violin")
        names = [b["name"] for b in resp.json()]
        assert names == ["High usage", "Mid usage", "Low usage"]

    async def test_empty_when_no_matches(self, client: AsyncClient):
        resp = await client.get("/api/library/blocks?instrument=violin")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_instrument_required(self, client: AsyncClient):
        resp = await client.get("/api/library/blocks")
        assert resp.status_code == 422

    async def test_unauthenticated(self, unauth_client: AsyncClient):
        resp = await unauth_client.get("/api/library/blocks?instrument=violin")
        assert resp.status_code == 401

    async def test_usage_percentage_zero_when_no_users(
        self, client: AsyncClient, db_session
    ):
        await _make_curated(db_session, "G major scale", usage_count=0)
        resp = await client.get("/api/library/blocks?instrument=violin")
        # No users have a violin instrument yet (test_user has no instrument
        # in this test), so percentage is 0
        data = resp.json()
        assert data[0]["usage_percentage"] == 0

    async def test_usage_percentage_with_user(
        self, client: AsyncClient, db_session, test_user, test_instrument
    ):
        """test_user has a Violin instrument from the fixture. Create a curated
        block and a template that references it. Percentage should be 100%."""
        cb = await _make_curated(db_session, "G major scale", instrument="Violin")

        template = Template(
            user_id=test_user.id,
            instrument_id=test_instrument.id,
            name="Plan",
        )
        db_session.add(template)
        await db_session.commit()
        await db_session.refresh(template)

        ts = TemplateSession(
            template_id=template.id, name="S1", display_order=0
        )
        db_session.add(ts)
        await db_session.commit()
        await db_session.refresh(ts)

        section = Section(
            template_session_id=ts.id,
            name="Scales",
            section_type="scales",
            display_order=0,
        )
        db_session.add(section)
        await db_session.commit()
        await db_session.refresh(section)

        block = Block(
            section_id=section.id,
            name="G major scale",
            curated_block_id=cb.id,
            display_order=0,
        )
        db_session.add(block)
        await db_session.commit()

        resp = await client.get("/api/library/blocks?instrument=Violin")
        data = resp.json()
        assert data[0]["usage_percentage"] == 100


# ===================================================================
# RECENTLY USED
# ===================================================================

class TestRecentBlocks:
    async def test_empty_recent(
        self, client: AsyncClient, test_instrument
    ):
        resp = await client.get(
            f"/api/library/recent?instrument_id={test_instrument.id}"
        )
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_returns_recent_blocks(
        self, client: AsyncClient, db_session, test_user, test_instrument
    ):
        await _make_practice_log_with_blocks(
            db_session, test_user, test_instrument,
            [
                {"block_name": "G major scale"},
                {"block_name": "D minor arpeggio"},
            ],
            practice_date=date(2026, 4, 1),
        )

        resp = await client.get(
            f"/api/library/recent?instrument_id={test_instrument.id}"
        )
        data = resp.json()
        assert len(data) == 2
        names = [b["name"] for b in data]
        assert "G major scale" in names
        assert "D minor arpeggio" in names

    async def test_dedupes_by_name(
        self, client: AsyncClient, db_session, test_user, test_instrument
    ):
        await _make_practice_log_with_blocks(
            db_session, test_user, test_instrument,
            [{"block_name": "G major scale"}],
            practice_date=date(2026, 4, 1),
        )
        await _make_practice_log_with_blocks(
            db_session, test_user, test_instrument,
            [{"block_name": "G major scale"}],
            practice_date=date(2026, 4, 5),
        )

        resp = await client.get(
            f"/api/library/recent?instrument_id={test_instrument.id}"
        )
        data = resp.json()
        # Same block_id null + same name → 1 row
        assert len(data) == 1
        assert data[0]["last_used_at"] == "2026-04-05"

    async def test_excludes_repertoire_blocks(
        self, client: AsyncClient, db_session, test_user, test_instrument
    ):
        # Create a repertoire block (Block with piece_id) and log it
        piece = Piece(instrument_id=test_instrument.id, name="Bruch")
        db_session.add(piece)
        await db_session.commit()
        await db_session.refresh(piece)

        spot = Spot(piece_id=piece.id, name="first page")
        db_session.add(spot)
        await db_session.commit()
        await db_session.refresh(spot)

        # Need a Block row with piece_id set
        template = Template(
            user_id=test_user.id, instrument_id=test_instrument.id, name="P"
        )
        db_session.add(template)
        await db_session.commit()
        await db_session.refresh(template)
        ts = TemplateSession(template_id=template.id, name="S", display_order=0)
        db_session.add(ts)
        await db_session.commit()
        await db_session.refresh(ts)
        section = Section(
            template_session_id=ts.id, name="Rep", section_type="repertoire",
            display_order=0,
        )
        db_session.add(section)
        await db_session.commit()
        await db_session.refresh(section)
        rep_block = Block(
            section_id=section.id, piece_id=piece.id, display_order=0
        )
        db_session.add(rep_block)
        await db_session.commit()
        await db_session.refresh(rep_block)

        # Log against the repertoire block
        await _make_practice_log_with_blocks(
            db_session, test_user, test_instrument,
            [
                {"block_name": "Bruch — first page",
                 "block_id": rep_block.id, "spot_id": spot.id},
                {"block_name": "G major scale"},  # standard freeform
            ],
        )

        resp = await client.get(
            f"/api/library/recent?instrument_id={test_instrument.id}"
        )
        data = resp.json()
        names = [b["name"] for b in data]
        assert "G major scale" in names
        assert "Bruch — first page" not in names

    async def test_excludes_other_users_logs(
        self, client: AsyncClient, db_session, other_user, test_instrument
    ):
        # other_user log on the SAME instrument id (which actually belongs
        # to test_user). Should not surface for current_user.
        await _make_practice_log_with_blocks(
            db_session, other_user, test_instrument,
            [{"block_name": "Foreign block"}],
        )
        resp = await client.get(
            f"/api/library/recent?instrument_id={test_instrument.id}"
        )
        names = [b["name"] for b in resp.json()]
        assert "Foreign block" not in names

    async def test_excludes_in_progress_sessions(
        self, client: AsyncClient, db_session, test_user, test_instrument
    ):
        await _make_practice_log_with_blocks(
            db_session, test_user, test_instrument,
            [{"block_name": "Incomplete block"}],
            status="in_progress",
        )
        resp = await client.get(
            f"/api/library/recent?instrument_id={test_instrument.id}"
        )
        assert resp.json() == []

    async def test_respects_limit(
        self, client: AsyncClient, db_session, test_user, test_instrument
    ):
        for i in range(15):
            await _make_practice_log_with_blocks(
                db_session, test_user, test_instrument,
                [{"block_name": f"Block {i}"}],
                practice_date=date(2026, 4, 1) + __import__("datetime").timedelta(days=i),
            )

        resp = await client.get(
            f"/api/library/recent?instrument_id={test_instrument.id}&limit=5"
        )
        assert len(resp.json()) == 5

    async def test_instrument_ownership_404(
        self, client: AsyncClient, db_session, other_user
    ):
        other_inst = Instrument(user_id=other_user.id, name="Guitar")
        db_session.add(other_inst)
        await db_session.commit()
        await db_session.refresh(other_inst)
        resp = await client.get(
            f"/api/library/recent?instrument_id={other_inst.id}"
        )
        assert resp.status_code == 404


# ===================================================================
# REPERTOIRE
# ===================================================================

class TestRepertoireLibrary:
    async def test_empty(self, client: AsyncClient, test_instrument):
        resp = await client.get(
            f"/api/library/repertoire?instrument_id={test_instrument.id}"
        )
        assert resp.status_code == 200
        assert resp.json() == {"pieces": []}

    async def test_returns_pieces_with_spots(
        self, client: AsyncClient, db_session, test_instrument
    ):
        piece = Piece(
            instrument_id=test_instrument.id,
            name="Bruch Concerto",
            composer_or_source="Max Bruch",
        )
        db_session.add(piece)
        await db_session.commit()
        await db_session.refresh(piece)

        for i, name in enumerate(["first page", "development"]):
            spot = Spot(piece_id=piece.id, name=name, display_order=i)
            db_session.add(spot)
        await db_session.commit()

        resp = await client.get(
            f"/api/library/repertoire?instrument_id={test_instrument.id}"
        )
        data = resp.json()
        assert len(data["pieces"]) == 1
        p = data["pieces"][0]
        assert p["name"] == "Bruch Concerto"
        assert p["composer_or_source"] == "Max Bruch"
        assert p["active_spot_count"] == 2
        assert len(p["spots"]) == 2
        assert p["spots"][0]["name"] == "first page"

    async def test_excludes_retired_spots_by_default(
        self, client: AsyncClient, db_session, test_instrument
    ):
        piece = Piece(instrument_id=test_instrument.id, name="P")
        db_session.add(piece)
        await db_session.commit()
        await db_session.refresh(piece)

        active = Spot(piece_id=piece.id, name="active", display_order=0)
        retired = Spot(
            piece_id=piece.id,
            name="retired",
            display_order=1,
            retired_at=utcnow(),
        )
        db_session.add_all([active, retired])
        await db_session.commit()

        resp = await client.get(
            f"/api/library/repertoire?instrument_id={test_instrument.id}"
        )
        data = resp.json()
        spots = data["pieces"][0]["spots"]
        names = [s["name"] for s in spots]
        assert "active" in names
        assert "retired" not in names
        # active_spot_count counts only active
        assert data["pieces"][0]["active_spot_count"] == 1

    async def test_includes_retired_when_requested(
        self, client: AsyncClient, db_session, test_instrument
    ):
        piece = Piece(instrument_id=test_instrument.id, name="P")
        db_session.add(piece)
        await db_session.commit()
        await db_session.refresh(piece)

        active = Spot(piece_id=piece.id, name="active", display_order=0)
        retired = Spot(
            piece_id=piece.id,
            name="retired",
            display_order=1,
            retired_at=utcnow(),
        )
        db_session.add_all([active, retired])
        await db_session.commit()

        resp = await client.get(
            f"/api/library/repertoire?instrument_id={test_instrument.id}"
            "&include_retired=true"
        )
        data = resp.json()
        names = [s["name"] for s in data["pieces"][0]["spots"]]
        assert "active" in names
        assert "retired" in names
        # active_spot_count is still 1 (it counts active regardless of flag)
        assert data["pieces"][0]["active_spot_count"] == 1

    async def test_excludes_deleted_pieces(
        self, client: AsyncClient, db_session, test_instrument
    ):
        piece = Piece(
            instrument_id=test_instrument.id, name="Deleted",
            deleted_at=utcnow(),
        )
        db_session.add(piece)
        await db_session.commit()

        resp = await client.get(
            f"/api/library/repertoire?instrument_id={test_instrument.id}"
        )
        assert resp.json() == {"pieces": []}

    async def test_last_practiced_at_via_spots(
        self, client: AsyncClient, db_session, test_user, test_instrument
    ):
        piece = Piece(instrument_id=test_instrument.id, name="P")
        db_session.add(piece)
        await db_session.commit()
        await db_session.refresh(piece)

        spot = Spot(piece_id=piece.id, name="s", display_order=0)
        db_session.add(spot)
        await db_session.commit()
        await db_session.refresh(spot)

        await _make_practice_log_with_blocks(
            db_session, test_user, test_instrument,
            [{"block_name": "P — s", "spot_id": spot.id}],
            practice_date=date(2026, 4, 5),
        )

        resp = await client.get(
            f"/api/library/repertoire?instrument_id={test_instrument.id}"
        )
        data = resp.json()
        assert data["pieces"][0]["last_practiced_at"] == "2026-04-05"

    async def test_instrument_ownership_404(
        self, client: AsyncClient, db_session, other_user
    ):
        other_inst = Instrument(user_id=other_user.id, name="Guitar")
        db_session.add(other_inst)
        await db_session.commit()
        await db_session.refresh(other_inst)
        resp = await client.get(
            f"/api/library/repertoire?instrument_id={other_inst.id}"
        )
        assert resp.status_code == 404
