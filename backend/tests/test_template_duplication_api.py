"""Tests for POST /api/templates/{id}/duplicate endpoint.

Covers deep copy integrity, repertoire-aware spot copying,
copy_default_spots=false, ownership, and inactive state.
"""
import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import (
    Instrument, Template, TemplateSession, Section, Block,
    Piece, Spot, TemplateBlockSpot,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def full_template(db_session: AsyncSession, test_user, test_instrument):
    """A template with 2 sessions, sections, standard + repertoire blocks."""
    template = Template(
        user_id=test_user.id,
        instrument_id=test_instrument.id,
        name="Bruch Plan",
        description="Learn the Bruch concerto",
        is_active=True,
        current_rotation_index=2,
    )
    db_session.add(template)
    await db_session.commit()
    await db_session.refresh(template)

    # Session 1 with standard + repertoire blocks
    ts1 = TemplateSession(
        template_id=template.id,
        name="Technique focus",
        focus_description="Slow practice",
        display_order=0,
    )
    db_session.add(ts1)
    await db_session.commit()
    await db_session.refresh(ts1)

    sec1 = Section(
        template_session_id=ts1.id,
        name="Warm-up",
        section_type="warmup",
        estimated_duration_minutes=5,
        display_order=0,
    )
    db_session.add(sec1)
    await db_session.commit()
    await db_session.refresh(sec1)

    std_block = Block(
        section_id=sec1.id,
        name="Open strings",
        tempo_bpm=60,
        display_order=0,
    )
    db_session.add(std_block)
    await db_session.commit()

    sec2 = Section(
        template_session_id=ts1.id,
        name="Repertoire",
        section_type="repertoire",
        estimated_duration_minutes=20,
        display_order=1,
    )
    db_session.add(sec2)
    await db_session.commit()
    await db_session.refresh(sec2)

    piece = Piece(
        instrument_id=test_instrument.id,
        name="Bruch Concerto",
        composer_or_source="Max Bruch",
    )
    db_session.add(piece)
    await db_session.commit()
    await db_session.refresh(piece)

    spots = []
    for i, name in enumerate(["first page", "development"]):
        spot = Spot(piece_id=piece.id, name=name, display_order=i)
        db_session.add(spot)
        await db_session.commit()
        await db_session.refresh(spot)
        spots.append(spot)

    rep_block = Block(
        section_id=sec2.id,
        piece_id=piece.id,
        display_order=0,
    )
    db_session.add(rep_block)
    await db_session.commit()
    await db_session.refresh(rep_block)

    for i, spot in enumerate(spots):
        tbs = TemplateBlockSpot(
            block_id=rep_block.id, spot_id=spot.id, display_order=i
        )
        db_session.add(tbs)
    await db_session.commit()

    # Session 2 (simpler)
    ts2 = TemplateSession(
        template_id=template.id,
        name="Repertoire day",
        display_order=1,
    )
    db_session.add(ts2)
    await db_session.commit()
    await db_session.refresh(ts2)

    sec3 = Section(
        template_session_id=ts2.id,
        name="Scales",
        section_type="scales",
        estimated_duration_minutes=10,
        display_order=0,
    )
    db_session.add(sec3)
    await db_session.commit()
    await db_session.refresh(sec3)

    scale_block = Block(
        section_id=sec3.id,
        name="G major 3 octaves",
        display_order=0,
    )
    db_session.add(scale_block)
    await db_session.commit()

    return {
        "template": template,
        "piece": piece,
        "spots": spots,
        "rep_block": rep_block,
    }


# ===================================================================
# DEEP COPY INTEGRITY
# ===================================================================

class TestDuplicateTemplate:
    async def test_duplicates_full_structure(
        self, client: AsyncClient, full_template
    ):
        t = full_template
        resp = await client.post(
            f"/api/templates/{t['template'].id}/duplicate",
            json={"copy_default_spots": True},
        )
        assert resp.status_code == 201
        data = resp.json()

        # New template metadata
        assert data["name"] == "Copy of Bruch Plan"
        assert data["description"] == "Learn the Bruch concerto"
        assert data["is_active"] is False
        assert data["current_rotation_index"] == 0
        assert data["id"] != t["template"].id
        assert data["instrument_id"] == t["template"].instrument_id

        # 2 sessions
        assert len(data["sessions"]) == 2
        s1 = data["sessions"][0]
        assert s1["name"] == "Technique focus"
        assert s1["focus_description"] == "Slow practice"
        assert s1["display_order"] == 0

        # Session 1: 2 sections
        assert len(s1["sections"]) == 2
        warmup = s1["sections"][0]
        assert warmup["name"] == "Warm-up"
        assert warmup["estimated_duration_minutes"] == 5

        # Standard block preserved
        assert len(warmup["blocks"]) == 1
        assert warmup["blocks"][0]["name"] == "Open strings"
        assert warmup["blocks"][0]["tempo_bpm"] == 60

        # Repertoire block with spots
        rep_sec = s1["sections"][1]
        assert len(rep_sec["blocks"]) == 1
        rep_blk = rep_sec["blocks"][0]
        assert rep_blk["piece_id"] == t["piece"].id
        assert rep_blk["piece_name"] == "Bruch Concerto"
        assert len(rep_blk["default_spots"]) == 2
        assert rep_blk["default_spots"][0]["name"] == "first page"
        assert rep_blk["default_spots"][1]["name"] == "development"

        # Session 2
        s2 = data["sessions"][1]
        assert s2["name"] == "Repertoire day"
        assert len(s2["sections"]) == 1
        assert s2["sections"][0]["blocks"][0]["name"] == "G major 3 octaves"

    async def test_spots_reference_same_entities(
        self, client: AsyncClient, full_template
    ):
        """Both templates should reference the same Spot IDs (not copies)."""
        t = full_template
        resp = await client.post(
            f"/api/templates/{t['template'].id}/duplicate",
            json={"copy_default_spots": True},
        )
        data = resp.json()
        rep_blk = data["sessions"][0]["sections"][1]["blocks"][0]
        spot_ids = [s["id"] for s in rep_blk["default_spots"]]
        original_ids = [s.id for s in t["spots"]]
        assert spot_ids == original_ids


class TestDuplicateWithoutSpots:
    async def test_repertoire_blocks_have_empty_default_spots(
        self, client: AsyncClient, full_template
    ):
        t = full_template
        resp = await client.post(
            f"/api/templates/{t['template'].id}/duplicate",
            json={"copy_default_spots": False},
        )
        assert resp.status_code == 201
        data = resp.json()

        # Repertoire block exists but no default spots
        rep_blk = data["sessions"][0]["sections"][1]["blocks"][0]
        assert rep_blk["piece_id"] == t["piece"].id
        assert rep_blk["piece_name"] == "Bruch Concerto"
        assert rep_blk["default_spots"] == []

    async def test_standard_blocks_still_copied(
        self, client: AsyncClient, full_template
    ):
        t = full_template
        resp = await client.post(
            f"/api/templates/{t['template'].id}/duplicate",
            json={"copy_default_spots": False},
        )
        data = resp.json()
        warmup_block = data["sessions"][0]["sections"][0]["blocks"][0]
        assert warmup_block["name"] == "Open strings"
        assert warmup_block["tempo_bpm"] == 60


class TestDuplicateDefaults:
    async def test_defaults_to_copy_spots_true(
        self, client: AsyncClient, full_template
    ):
        t = full_template
        resp = await client.post(
            f"/api/templates/{t['template'].id}/duplicate",
            json={},
        )
        assert resp.status_code == 201
        rep_blk = resp.json()["sessions"][0]["sections"][1]["blocks"][0]
        assert len(rep_blk["default_spots"]) == 2


class TestDuplicateOwnership:
    async def test_cannot_duplicate_other_users_template(
        self, other_user_client: AsyncClient, full_template
    ):
        t = full_template
        resp = await other_user_client.post(
            f"/api/templates/{t['template'].id}/duplicate",
            json={},
        )
        assert resp.status_code == 404

    async def test_not_found_returns_404(self, client: AsyncClient):
        resp = await client.post(
            "/api/templates/99999/duplicate",
            json={},
        )
        assert resp.status_code == 404

    async def test_deleted_template_returns_404(
        self, client: AsyncClient, db_session, full_template
    ):
        t = full_template
        from app.enums import utcnow
        t["template"].deleted_at = utcnow()
        db_session.add(t["template"])
        await db_session.commit()

        resp = await client.post(
            f"/api/templates/{t['template'].id}/duplicate",
            json={},
        )
        assert resp.status_code == 404
