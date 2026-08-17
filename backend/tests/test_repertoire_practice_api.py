"""Tests for repertoire blocks in the practice session lifecycle.

Covers scaffolding per-spot block logs, add-spot-mid-session,
collapse-to-piece / expand-to-spots round trip, zero-default-spots
placeholder, and finish session with per-spot logs.
"""
import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import (
    Instrument, Template, TemplateSession, Section, Block,
    Piece, Spot, TemplateBlockSpot, PracticeLog, SectionLog, BlockLog,
)
from app.enums import utcnow


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def repertoire_template(db_session: AsyncSession, test_user, test_instrument):
    """Template with a repertoire section containing a Bruch block with 3 spots,
    plus a standard warm-up block."""
    template = Template(
        user_id=test_user.id,
        instrument_id=test_instrument.id,
        name="Bruch Plan",
    )
    db_session.add(template)
    await db_session.commit()
    await db_session.refresh(template)

    ts = TemplateSession(
        template_id=template.id, name="Session 1", display_order=0
    )
    db_session.add(ts)
    await db_session.commit()
    await db_session.refresh(ts)

    # Warm-up section with standard block
    warmup = Section(
        template_session_id=ts.id,
        name="Warm-up",
        section_type="warmup",
        estimated_duration_minutes=5,
        display_order=0,
    )
    db_session.add(warmup)
    await db_session.commit()
    await db_session.refresh(warmup)

    std_block = Block(
        section_id=warmup.id, name="Open strings", display_order=0
    )
    db_session.add(std_block)
    await db_session.commit()

    # Repertoire section
    rep_section = Section(
        template_session_id=ts.id,
        name="Repertoire",
        section_type="repertoire",
        estimated_duration_minutes=20,
        display_order=1,
    )
    db_session.add(rep_section)
    await db_session.commit()
    await db_session.refresh(rep_section)

    # Piece + spots
    piece = Piece(
        instrument_id=test_instrument.id,
        name="Bruch Concerto",
        composer_or_source="Max Bruch",
    )
    db_session.add(piece)
    await db_session.commit()
    await db_session.refresh(piece)

    spots = []
    for i, (name, loc) in enumerate([
        ("first page", "mm. 1-32"),
        ("development", None),
        ("trouble spots", "mm. 24-28"),
    ]):
        spot = Spot(piece_id=piece.id, name=name, location=loc, display_order=i)
        db_session.add(spot)
        await db_session.commit()
        await db_session.refresh(spot)
        spots.append(spot)

    # Repertoire block with default spots
    rep_block = Block(
        section_id=rep_section.id, piece_id=piece.id, display_order=0
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

    return {
        "template": template,
        "session": ts,
        "warmup": warmup,
        "rep_section": rep_section,
        "piece": piece,
        "spots": spots,
        "rep_block": rep_block,
    }


# ===================================================================
# SCAFFOLDING
# ===================================================================

class TestRepertoireScaffolding:
    async def test_scaffolds_per_spot_block_logs(
        self, client: AsyncClient, repertoire_template
    ):
        t = repertoire_template
        resp = await client.post("/api/practice/start", json={
            "instrument_id": t["template"].instrument_id,
            "template_id": t["template"].id,
            "template_session_id": t["session"].id,
        })
        assert resp.status_code == 201
        data = resp.json()

        # Should have 2 sections: warm-up + repertoire
        assert len(data["section_logs"]) == 2

        warmup_section = data["section_logs"][0]
        assert len(warmup_section["block_logs"]) == 1
        assert warmup_section["block_logs"][0]["block_name"] == "Open strings"
        assert warmup_section["block_logs"][0]["spot_id"] is None

        rep_section = data["section_logs"][1]
        # 3 spots = 3 block logs
        assert len(rep_section["block_logs"]) == 3
        for bl in rep_section["block_logs"]:
            assert bl["spot_id"] is not None
            assert bl["completed"] is False
            assert bl["rating"] is None
            assert "Bruch Concerto" in bl["block_name"]

        names = [bl["block_name"] for bl in rep_section["block_logs"]]
        assert any("first page" in n for n in names)
        assert any("development" in n for n in names)
        assert any("trouble spots" in n for n in names)

    async def test_zero_default_spots_creates_placeholder(
        self, client: AsyncClient, db_session, test_user, test_instrument
    ):
        """A repertoire block with no default spots should scaffold a
        single placeholder BlockLog with spot_id=null."""
        template = Template(
            user_id=test_user.id,
            instrument_id=test_instrument.id,
            name="Empty Plan",
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
            name="Repertoire",
            section_type="repertoire",
            estimated_duration_minutes=10,
            display_order=0,
        )
        db_session.add(section)
        await db_session.commit()
        await db_session.refresh(section)

        piece = Piece(
            instrument_id=test_instrument.id, name="New Piece"
        )
        db_session.add(piece)
        await db_session.commit()
        await db_session.refresh(piece)

        block = Block(
            section_id=section.id, piece_id=piece.id, display_order=0
        )
        db_session.add(block)
        await db_session.commit()

        resp = await client.post("/api/practice/start", json={
            "instrument_id": test_instrument.id,
            "template_id": template.id,
            "template_session_id": ts.id,
        })
        assert resp.status_code == 201
        data = resp.json()
        bls = data["section_logs"][0]["block_logs"]
        assert len(bls) == 1
        assert bls[0]["spot_id"] is None
        assert bls[0]["block_name"] == "New Piece"

    async def test_retired_spots_excluded_from_scaffolding(
        self, client: AsyncClient, db_session, repertoire_template
    ):
        t = repertoire_template
        # Retire one spot
        t["spots"][2].retired_at = utcnow()
        db_session.add(t["spots"][2])
        await db_session.commit()

        resp = await client.post("/api/practice/start", json={
            "instrument_id": t["template"].instrument_id,
            "template_id": t["template"].id,
            "template_session_id": t["session"].id,
        })
        data = resp.json()
        rep_section = data["section_logs"][1]
        # Only 2 active spots should be scaffolded
        assert len(rep_section["block_logs"]) == 2


# ===================================================================
# ADD SPOT MID-SESSION
# ===================================================================

class TestAddSpotMidSession:
    async def test_add_spot_with_rotation(
        self, client: AsyncClient, db_session, repertoire_template
    ):
        t = repertoire_template
        resp = await client.post("/api/practice/start", json={
            "instrument_id": t["template"].instrument_id,
            "template_id": t["template"].id,
            "template_session_id": t["session"].id,
        })
        log_id = resp.json()["id"]
        # Get a repertoire block log
        rep_bls = resp.json()["section_logs"][1]["block_logs"]
        bl_id = rep_bls[0]["id"]

        resp = await client.post(
            f"/api/practice/{log_id}/blocks/{bl_id}/spots",
            json={"name": "cadenza", "location": "end of mvt I"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["spot_id"] is not None
        assert "cadenza" in data["block_name"]
        assert data["completed"] is False

        # Verify spot was created on the piece
        resp = await client.get(f"/api/pieces/{t['piece'].id}")
        spot_names = [s["name"] for s in resp.json()["spots"]]
        assert "cadenza" in spot_names

        # Verify spot was added to the template block's default list
        result = await db_session.exec(
            select(TemplateBlockSpot).where(
                TemplateBlockSpot.block_id == t["rep_block"].id
            )
        )
        tbs_list = result.all()
        assert len(tbs_list) == 4  # 3 original + 1 new

    async def test_add_spot_without_rotation(
        self, client: AsyncClient, db_session, repertoire_template
    ):
        t = repertoire_template
        resp = await client.post("/api/practice/start", json={
            "instrument_id": t["template"].instrument_id,
            "template_id": t["template"].id,
            "template_session_id": t["session"].id,
        })
        log_id = resp.json()["id"]
        bl_id = resp.json()["section_logs"][1]["block_logs"][0]["id"]

        resp = await client.post(
            f"/api/practice/{log_id}/blocks/{bl_id}/spots",
            json={"name": "coda", "add_to_rotation": False},
        )
        assert resp.status_code == 201

        # Spot should exist on the piece
        resp = await client.get(f"/api/pieces/{t['piece'].id}")
        spot_names = [s["name"] for s in resp.json()["spots"]]
        assert "coda" in spot_names

        # But NOT in the template block's default list
        result = await db_session.exec(
            select(TemplateBlockSpot).where(
                TemplateBlockSpot.block_id == t["rep_block"].id
            )
        )
        tbs_list = result.all()
        assert len(tbs_list) == 3  # unchanged

    async def test_reject_on_standard_block(
        self, client: AsyncClient, repertoire_template
    ):
        t = repertoire_template
        resp = await client.post("/api/practice/start", json={
            "instrument_id": t["template"].instrument_id,
            "template_id": t["template"].id,
            "template_session_id": t["session"].id,
        })
        log_id = resp.json()["id"]
        # Use the warm-up block log (standard)
        std_bl_id = resp.json()["section_logs"][0]["block_logs"][0]["id"]

        resp = await client.post(
            f"/api/practice/{log_id}/blocks/{std_bl_id}/spots",
            json={"name": "nope"},
        )
        assert resp.status_code == 400


# ===================================================================
# COLLAPSE / EXPAND
# ===================================================================

class TestCollapseTopiece:
    async def test_collapse_deletes_spot_logs_creates_piece_log(
        self, client: AsyncClient, repertoire_template
    ):
        t = repertoire_template
        resp = await client.post("/api/practice/start", json={
            "instrument_id": t["template"].instrument_id,
            "template_id": t["template"].id,
            "template_session_id": t["session"].id,
        })
        log_id = resp.json()["id"]
        rep_bls = resp.json()["section_logs"][1]["block_logs"]
        assert len(rep_bls) == 3
        bl_id = rep_bls[0]["id"]

        resp = await client.put(
            f"/api/practice/{log_id}/blocks/{bl_id}/collapse-to-piece",
            json={"rating": 0, "notes": "quick run-through"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["spot_id"] is None
        assert data["block_name"] == "Bruch Concerto"
        assert data["rating"] == 0
        assert data["notes"] == "quick run-through"
        assert data["completed"] is True  # rating was provided

        # Verify only 1 block log remains for this block
        resp = await client.get(f"/api/practice/{log_id}")
        rep_section = resp.json()["section_logs"][1]
        assert len(rep_section["block_logs"]) == 1

    async def test_collapse_without_rating(
        self, client: AsyncClient, repertoire_template
    ):
        t = repertoire_template
        resp = await client.post("/api/practice/start", json={
            "instrument_id": t["template"].instrument_id,
            "template_id": t["template"].id,
            "template_session_id": t["session"].id,
        })
        log_id = resp.json()["id"]
        bl_id = resp.json()["section_logs"][1]["block_logs"][0]["id"]

        resp = await client.put(
            f"/api/practice/{log_id}/blocks/{bl_id}/collapse-to-piece",
            json={},
        )
        assert resp.status_code == 200
        assert resp.json()["rating"] is None
        assert resp.json()["completed"] is False


class TestExpandToSpots:
    async def test_expand_restores_per_spot_logs(
        self, client: AsyncClient, repertoire_template
    ):
        t = repertoire_template
        # Start session
        resp = await client.post("/api/practice/start", json={
            "instrument_id": t["template"].instrument_id,
            "template_id": t["template"].id,
            "template_session_id": t["session"].id,
        })
        log_id = resp.json()["id"]
        bl_id = resp.json()["section_logs"][1]["block_logs"][0]["id"]

        # Collapse
        resp = await client.put(
            f"/api/practice/{log_id}/blocks/{bl_id}/collapse-to-piece",
            json={"rating": 0},
        )
        collapsed_id = resp.json()["id"]

        # Expand
        resp = await client.put(
            f"/api/practice/{log_id}/blocks/{collapsed_id}/expand-to-spots",
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 3
        for bl in data:
            assert bl["spot_id"] is not None
            assert bl["completed"] is False
            assert bl["rating"] is None


class TestCollapseExpandRoundTrip:
    async def test_full_round_trip(
        self, client: AsyncClient, repertoire_template
    ):
        """Start -> 3 spots -> collapse -> 1 piece log -> expand -> 3 spots."""
        t = repertoire_template
        resp = await client.post("/api/practice/start", json={
            "instrument_id": t["template"].instrument_id,
            "template_id": t["template"].id,
            "template_session_id": t["session"].id,
        })
        log_id = resp.json()["id"]

        # Verify 3 spot logs
        resp = await client.get(f"/api/practice/{log_id}")
        rep_bls = resp.json()["section_logs"][1]["block_logs"]
        assert len(rep_bls) == 3
        assert all(bl["spot_id"] is not None for bl in rep_bls)

        # Collapse
        bl_id = rep_bls[0]["id"]
        resp = await client.put(
            f"/api/practice/{log_id}/blocks/{bl_id}/collapse-to-piece",
            json={},
        )
        collapsed_id = resp.json()["id"]

        # Verify 1 piece log
        resp = await client.get(f"/api/practice/{log_id}")
        rep_bls = resp.json()["section_logs"][1]["block_logs"]
        assert len(rep_bls) == 1
        assert rep_bls[0]["spot_id"] is None

        # Expand
        resp = await client.put(
            f"/api/practice/{log_id}/blocks/{collapsed_id}/expand-to-spots",
        )
        expanded = resp.json()
        assert len(expanded) == 3

        # Verify via GET
        resp = await client.get(f"/api/practice/{log_id}")
        rep_bls = resp.json()["section_logs"][1]["block_logs"]
        assert len(rep_bls) == 3
        assert all(bl["spot_id"] is not None for bl in rep_bls)


# ===================================================================
# FINISH SESSION WITH REPERTOIRE BLOCKS
# ===================================================================

class TestFinishWithRepertoire:
    async def test_finish_counts_per_spot_logs(
        self, client: AsyncClient, repertoire_template
    ):
        t = repertoire_template
        resp = await client.post("/api/practice/start", json={
            "instrument_id": t["template"].instrument_id,
            "template_id": t["template"].id,
            "template_session_id": t["session"].id,
        })
        log_id = resp.json()["id"]

        # Rate all block logs
        resp = await client.get(f"/api/practice/{log_id}")
        all_bls = []
        for sl in resp.json()["section_logs"]:
            all_bls.extend(sl["block_logs"])

        for bl in all_bls:
            await client.put(
                f"/api/practice/{log_id}/blocks/{bl['id']}",
                json={"rating": 1, "completed": True},
            )

        # Finish
        resp = await client.post(f"/api/practice/{log_id}/finish")
        assert resp.status_code == 200
        summary = resp.json()["summary"]
        # 1 standard block + 3 spot logs = 4 exercises
        assert summary["exercises_total"] == 4
        assert summary["exercises_completed"] == 4
        assert summary["ratings"]["step_forward"] == 4


# ===================================================================
# ALL SPOTS RETIRED — edge case
# ===================================================================

class TestAllSpotsRetired:
    async def test_all_spots_retired_creates_placeholder(
        self, client: AsyncClient, db_session, repertoire_template
    ):
        """When all default spots are retired, scaffolding should create
        a single placeholder piece-level BlockLog (like zero-spots case)."""
        t = repertoire_template
        for spot in t["spots"]:
            spot.retired_at = utcnow()
            db_session.add(spot)
        await db_session.commit()

        resp = await client.post("/api/practice/start", json={
            "instrument_id": t["template"].instrument_id,
            "template_id": t["template"].id,
            "template_session_id": t["session"].id,
        })
        assert resp.status_code == 201
        rep_bls = resp.json()["section_logs"][1]["block_logs"]
        assert len(rep_bls) == 1
        assert rep_bls[0]["spot_id"] is None
        assert rep_bls[0]["block_name"] == "Bruch Concerto"


# ===================================================================
# PIECE NAME ON BLOCK LOGS (#274)
# ===================================================================

class TestBlockLogPieceName:
    """`piece_name` comes from block_id → Block.piece_id → Piece.name.

    `block_name` is denormalized as "{piece} — {spot}", so it can't be split
    back apart when the title itself contains the " — " separator — the
    relationship is the only source that survives such a title.
    """

    @staticmethod
    async def _start_with_piece_named(client, db_session, t, name):
        """Rename the fixture's piece, then start a session on it."""
        t["piece"].name = name
        db_session.add(t["piece"])
        await db_session.commit()

        resp = await client.post("/api/practice/start", json={
            "instrument_id": t["template"].instrument_id,
            "template_id": t["template"].id,
            "template_session_id": t["session"].id,
        })
        assert resp.status_code == 201
        return resp.json()

    async def test_piece_name_survives_separator_in_title(
        self, client: AsyncClient, db_session, repertoire_template
    ):
        t = repertoire_template
        data = await self._start_with_piece_named(
            client, db_session, t, "Sonata — No. 2"
        )

        rep_bls = data["section_logs"][1]["block_logs"]
        assert len(rep_bls) == 3
        for bl in rep_bls:
            assert bl["piece_name"] == "Sonata — No. 2"
        # The denormalized name still carries both halves, ambiguously.
        assert rep_bls[0]["block_name"] == "Sonata — No. 2 — first page"

        # And on a re-read of the log
        resp = await client.get(f"/api/practice/{data['id']}")
        rep_bls = resp.json()["section_logs"][1]["block_logs"]
        assert all(bl["piece_name"] == "Sonata — No. 2" for bl in rep_bls)

    async def test_standard_block_has_no_piece_name(
        self, client: AsyncClient, repertoire_template
    ):
        t = repertoire_template
        resp = await client.post("/api/practice/start", json={
            "instrument_id": t["template"].instrument_id,
            "template_id": t["template"].id,
            "template_session_id": t["session"].id,
        })
        warmup_bl = resp.json()["section_logs"][0]["block_logs"][0]
        assert warmup_bl["block_name"] == "Open strings"
        assert warmup_bl["piece_name"] is None

    async def test_freeform_block_has_no_piece_name(
        self, client: AsyncClient, repertoire_template
    ):
        t = repertoire_template
        resp = await client.post("/api/practice/start", json={
            "instrument_id": t["template"].instrument_id,
            "template_id": t["template"].id,
            "template_session_id": t["session"].id,
        })
        log_id = resp.json()["id"]
        sl_id = resp.json()["section_logs"][0]["id"]

        resp = await client.post(
            f"/api/practice/{log_id}/sections/{sl_id}/blocks",
            json={"block_name": "Improvising"},
        )
        assert resp.status_code == 201
        assert resp.json()["piece_name"] is None

    async def test_piece_name_survives_deleted_spot_and_piece(
        self, client: AsyncClient, db_session, repertoire_template
    ):
        """Historical logs stay readable after the spot and piece are gone.

        Both deletes are soft, so the relationship still resolves — the
        piece renders in full even though nothing links to it any more.
        """
        t = repertoire_template
        data = await self._start_with_piece_named(
            client, db_session, t, "Suite — BWV 1007"
        )
        log_id = data["id"]

        # Complete the session so it shows up in Progress → History
        for sl in data["section_logs"]:
            for bl in sl["block_logs"]:
                await client.put(
                    f"/api/practice/{log_id}/blocks/{bl['id']}",
                    json={"rating": 0, "completed": True},
                )
        resp = await client.post(f"/api/practice/{log_id}/finish")
        assert resp.status_code == 200

        # Delete a spot, then the whole piece
        resp = await client.delete(f"/api/spots/{t['spots'][0].id}")
        assert resp.status_code == 204
        resp = await client.delete(f"/api/pieces/{t['piece'].id}")
        assert resp.status_code == 204

        resp = await client.get(f"/api/progress/history/{log_id}")
        assert resp.status_code == 200
        rep_bls = resp.json()["section_logs"][1]["block_logs"]
        assert len(rep_bls) == 3
        for bl in rep_bls:
            assert bl["piece_name"] == "Suite — BWV 1007"
            assert bl["block_name"].startswith("Suite — BWV 1007 — ")

    async def test_piece_name_null_when_block_is_gone(
        self, client: AsyncClient, db_session, repertoire_template
    ):
        """A template block hard-deleted out from under the log nulls
        block_id (ON DELETE SET NULL), leaving block_name as the record."""
        t = repertoire_template
        data = await self._start_with_piece_named(
            client, db_session, t, "Caprice — No. 24"
        )
        log_id = data["id"]

        block = await db_session.get(Block, t["rep_block"].id)
        await db_session.delete(block)
        await db_session.commit()

        resp = await client.get(f"/api/practice/{log_id}")
        rep_bls = resp.json()["section_logs"][1]["block_logs"]
        assert len(rep_bls) == 3
        for bl in rep_bls:
            assert bl["block_id"] is None
            assert bl["piece_name"] is None
            # Denormalized name is all that's left — still readable.
            assert bl["block_name"].startswith("Caprice — No. 24 — ")

    async def test_mutation_responses_carry_piece_name(
        self, client: AsyncClient, db_session, repertoire_template
    ):
        """The in-session mutations return block logs the UI renders
        directly, so they carry piece_name too."""
        t = repertoire_template
        data = await self._start_with_piece_named(
            client, db_session, t, "Nocturne — Op. 9 No. 2"
        )
        log_id = data["id"]
        bl_id = data["section_logs"][1]["block_logs"][0]["id"]
        piece = "Nocturne — Op. 9 No. 2"

        resp = await client.put(
            f"/api/practice/{log_id}/blocks/{bl_id}",
            json={"rating": 1, "completed": True},
        )
        assert resp.json()["piece_name"] == piece

        resp = await client.post(
            f"/api/practice/{log_id}/blocks/{bl_id}/spots",
            json={"name": "coda"},
        )
        assert resp.json()["piece_name"] == piece

        resp = await client.put(
            f"/api/practice/{log_id}/blocks/{bl_id}/collapse-to-piece",
            json={},
        )
        assert resp.json()["piece_name"] == piece
        collapsed_id = resp.json()["id"]

        resp = await client.put(
            f"/api/practice/{log_id}/blocks/{collapsed_id}/expand-to-spots",
        )
        assert all(bl["piece_name"] == piece for bl in resp.json())

        # mark_all_done returns the section with its block logs
        sl_id = data["section_logs"][1]["id"]
        resp = await client.put(
            f"/api/practice/{log_id}/sections/{sl_id}",
            json={"mark_all_done": True},
        )
        assert all(
            bl["piece_name"] == piece for bl in resp.json()["block_logs"]
        )


# ===================================================================
# CROSS-USER SECURITY
# ===================================================================

class TestCrossUserSecurity:
    async def test_cannot_add_spot_to_other_users_session(
        self, other_user_client: AsyncClient, db_session, other_user
    ):
        """other_user cannot access a practice log they don't own."""
        resp = await other_user_client.post(
            "/api/practice/999/blocks/999/spots",
            json={"name": "stolen spot"},
        )
        assert resp.status_code == 404

    async def test_cannot_collapse_other_users_session(
        self, other_user_client: AsyncClient,
    ):
        resp = await other_user_client.put(
            "/api/practice/999/blocks/999/collapse-to-piece",
            json={},
        )
        assert resp.status_code == 404

    async def test_cannot_expand_other_users_session(
        self, other_user_client: AsyncClient,
    ):
        resp = await other_user_client.put(
            "/api/practice/999/blocks/999/expand-to-spots",
        )
        assert resp.status_code == 404
