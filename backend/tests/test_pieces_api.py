"""Tests for /api pieces and spots endpoints.

Covers CRUD, ownership validation, retire vs. delete semantics,
cascade behavior, computed fields, and the spot history endpoint.
"""
import pytest
from datetime import date
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models import (
    Instrument, Piece, Spot, Block, BlockLog,
    PracticeLog, SectionLog, Section, Template, TemplateSession,
    TemplateBlockSpot,
)
from app.enums import utcnow


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _make_instrument(db_session, user, name="Violin"):
    inst = Instrument(user_id=user.id, name=name)
    db_session.add(inst)
    await db_session.commit()
    await db_session.refresh(inst)
    return inst


async def _make_piece(db_session, instrument, name="Bruch Concerto", composer=None):
    piece = Piece(
        instrument_id=instrument.id, name=name, composer_or_source=composer
    )
    db_session.add(piece)
    await db_session.commit()
    await db_session.refresh(piece)
    return piece


async def _make_spot(db_session, piece, name="first page", location=None, order=0):
    spot = Spot(
        piece_id=piece.id, name=name, location=location, display_order=order
    )
    db_session.add(spot)
    await db_session.commit()
    await db_session.refresh(spot)
    return spot


async def _make_practice_log_with_block_log(
    db_session, user, instrument, spot=None, block=None,
    rating=1, notes=None, practice_date=None, status="completed",
):
    """Create a completed practice log with a single block log."""
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

    sec_log = SectionLog(
        practice_log_id=log.id,
        section_type="repertoire",
        section_name="Repertoire",
        actual_duration_minutes=30,
    )
    db_session.add(sec_log)
    await db_session.commit()
    await db_session.refresh(sec_log)

    block_name = "Bruch Concerto"
    if spot:
        block_name = f"Bruch Concerto — {spot.name}"

    bl = BlockLog(
        section_log_id=sec_log.id,
        block_id=block.id if block else None,
        spot_id=spot.id if spot else None,
        block_name=block_name,
        rating=rating,
        notes=notes,
        completed=True,
    )
    db_session.add(bl)
    await db_session.commit()
    await db_session.refresh(bl)
    return log, bl


# ===================================================================
# PIECES
# ===================================================================

class TestListPieces:
    async def test_empty_list(self, client: AsyncClient, test_instrument):
        resp = await client.get(f"/api/instruments/{test_instrument.id}/pieces")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_returns_pieces(
        self, client: AsyncClient, db_session, test_instrument
    ):
        await _make_piece(db_session, test_instrument, "Bruch Concerto", "Bruch")
        await _make_piece(db_session, test_instrument, "Bach Partita", "Bach")

        resp = await client.get(f"/api/instruments/{test_instrument.id}/pieces")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        names = [p["name"] for p in data]
        assert "Bach Partita" in names
        assert "Bruch Concerto" in names

    async def test_excludes_deleted_pieces(
        self, client: AsyncClient, db_session, test_instrument
    ):
        piece = await _make_piece(db_session, test_instrument)
        piece.deleted_at = utcnow()
        db_session.add(piece)
        await db_session.commit()

        resp = await client.get(f"/api/instruments/{test_instrument.id}/pieces")
        assert resp.json() == []

    async def test_excludes_other_users_instruments(
        self, client: AsyncClient, db_session, other_user
    ):
        other_inst = await _make_instrument(db_session, other_user, "Guitar")
        await _make_piece(db_session, other_inst, "Some Piece")

        resp = await client.get(f"/api/instruments/{other_inst.id}/pieces")
        assert resp.status_code == 404

    async def test_instrument_not_found(self, client: AsyncClient):
        resp = await client.get("/api/instruments/99999/pieces")
        assert resp.status_code == 404

    async def test_unauthenticated_returns_401(
        self, unauth_client: AsyncClient, test_instrument
    ):
        resp = await unauth_client.get(
            f"/api/instruments/{test_instrument.id}/pieces"
        )
        assert resp.status_code == 401


class TestCreatePiece:
    async def test_create_basic(self, client: AsyncClient, test_instrument):
        resp = await client.post(
            f"/api/instruments/{test_instrument.id}/pieces",
            json={"name": "Bruch Concerto"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Bruch Concerto"
        assert data["composer_or_source"] is None
        assert data["instrument_id"] == test_instrument.id
        assert data["session_count"] == 0
        assert data["last_practiced_at"] is None
        assert data["id"] is not None

    async def test_create_with_composer(self, client: AsyncClient, test_instrument):
        resp = await client.post(
            f"/api/instruments/{test_instrument.id}/pieces",
            json={"name": "Bruch Concerto", "composer_or_source": "Max Bruch"},
        )
        assert resp.status_code == 201
        assert resp.json()["composer_or_source"] == "Max Bruch"

    async def test_empty_name_returns_422(self, client: AsyncClient, test_instrument):
        resp = await client.post(
            f"/api/instruments/{test_instrument.id}/pieces",
            json={"name": ""},
        )
        assert resp.status_code == 422

    async def test_cannot_create_on_other_users_instrument(
        self, client: AsyncClient, db_session, other_user
    ):
        other_inst = await _make_instrument(db_session, other_user)
        resp = await client.post(
            f"/api/instruments/{other_inst.id}/pieces",
            json={"name": "Stolen Piece"},
        )
        assert resp.status_code == 404


class TestGetPiece:
    async def test_get_detail_with_spots(
        self, client: AsyncClient, db_session, test_instrument
    ):
        piece = await _make_piece(db_session, test_instrument)
        await _make_spot(db_session, piece, "first page", "mm. 1-32", 0)
        await _make_spot(db_session, piece, "development", None, 1)

        resp = await client.get(f"/api/pieces/{piece.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Bruch Concerto"
        assert len(data["spots"]) == 2
        assert data["spots"][0]["name"] == "first page"
        assert data["spots"][0]["location"] == "mm. 1-32"
        assert data["spots"][1]["name"] == "development"

    async def test_excludes_deleted_spots(
        self, client: AsyncClient, db_session, test_instrument
    ):
        piece = await _make_piece(db_session, test_instrument)
        spot = await _make_spot(db_session, piece, "deleted spot")
        spot.deleted_at = utcnow()
        db_session.add(spot)
        await db_session.commit()

        resp = await client.get(f"/api/pieces/{piece.id}")
        assert len(resp.json()["spots"]) == 0

    async def test_excludes_retired_spots_by_default(
        self, client: AsyncClient, db_session, test_instrument
    ):
        piece = await _make_piece(db_session, test_instrument)
        spot = await _make_spot(db_session, piece, "retired spot")
        spot.retired_at = utcnow()
        db_session.add(spot)
        await db_session.commit()

        resp = await client.get(f"/api/pieces/{piece.id}")
        assert len(resp.json()["spots"]) == 0

    async def test_includes_retired_spots_when_requested(
        self, client: AsyncClient, db_session, test_instrument
    ):
        piece = await _make_piece(db_session, test_instrument)
        spot = await _make_spot(db_session, piece, "retired spot")
        spot.retired_at = utcnow()
        db_session.add(spot)
        await db_session.commit()

        resp = await client.get(
            f"/api/pieces/{piece.id}?include_retired_spots=true"
        )
        assert len(resp.json()["spots"]) == 1
        assert resp.json()["spots"][0]["retired_at"] is not None

    async def test_not_found(self, client: AsyncClient):
        resp = await client.get("/api/pieces/99999")
        assert resp.status_code == 404

    async def test_cannot_access_other_users_piece(
        self, client: AsyncClient, db_session, other_user
    ):
        other_inst = await _make_instrument(db_session, other_user)
        other_piece = await _make_piece(db_session, other_inst)

        resp = await client.get(f"/api/pieces/{other_piece.id}")
        assert resp.status_code == 404


class TestUpdatePiece:
    async def test_update_name(
        self, client: AsyncClient, db_session, test_instrument
    ):
        piece = await _make_piece(db_session, test_instrument, "Old Name")
        resp = await client.patch(
            f"/api/pieces/{piece.id}", json={"name": "New Name"}
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "New Name"

    async def test_update_composer(
        self, client: AsyncClient, db_session, test_instrument
    ):
        piece = await _make_piece(db_session, test_instrument)
        resp = await client.patch(
            f"/api/pieces/{piece.id}", json={"composer_or_source": "Max Bruch"}
        )
        assert resp.status_code == 200
        assert resp.json()["composer_or_source"] == "Max Bruch"

    async def test_empty_body_no_change(
        self, client: AsyncClient, db_session, test_instrument
    ):
        piece = await _make_piece(db_session, test_instrument, "Same Name")
        resp = await client.patch(f"/api/pieces/{piece.id}", json={})
        assert resp.status_code == 200
        assert resp.json()["name"] == "Same Name"

    async def test_not_found(self, client: AsyncClient):
        resp = await client.patch("/api/pieces/99999", json={"name": "X"})
        assert resp.status_code == 404

    async def test_cannot_update_other_users_piece(
        self, client: AsyncClient, db_session, other_user
    ):
        other_inst = await _make_instrument(db_session, other_user)
        other_piece = await _make_piece(db_session, other_inst)
        resp = await client.patch(
            f"/api/pieces/{other_piece.id}", json={"name": "Stolen"}
        )
        assert resp.status_code == 404


class TestDeletePiece:
    async def test_soft_deletes_piece(
        self, client: AsyncClient, db_session, test_instrument
    ):
        piece = await _make_piece(db_session, test_instrument)
        resp = await client.delete(f"/api/pieces/{piece.id}")
        assert resp.status_code == 204

        await db_session.refresh(piece)
        assert piece.deleted_at is not None

    async def test_cascades_soft_delete_to_spots(
        self, client: AsyncClient, db_session, test_instrument
    ):
        piece = await _make_piece(db_session, test_instrument)
        spot = await _make_spot(db_session, piece)

        await client.delete(f"/api/pieces/{piece.id}")

        await db_session.refresh(spot)
        assert spot.deleted_at is not None

    async def test_preserves_block_logs_on_piece_delete(
        self, client: AsyncClient, db_session, test_user, test_instrument
    ):
        """Soft-deleting a piece cascades to spots but block_logs survive
        with their denormalized block_name intact."""
        piece = await _make_piece(db_session, test_instrument)
        spot = await _make_spot(db_session, piece)

        _, bl = await _make_practice_log_with_block_log(
            db_session, test_user, test_instrument, spot=spot
        )
        original_block_name = bl.block_name

        await client.delete(f"/api/pieces/{piece.id}")

        await db_session.refresh(bl)
        # Block log survives with name intact
        assert bl.block_name == original_block_name
        # spot_id is still set (soft-delete, not hard-delete)
        assert bl.spot_id == spot.id

    async def test_not_found(self, client: AsyncClient):
        resp = await client.delete("/api/pieces/99999")
        assert resp.status_code == 404


class TestPieceComputedFields:
    async def test_session_count_and_last_practiced(
        self, client: AsyncClient, db_session, test_user, test_instrument
    ):
        piece = await _make_piece(db_session, test_instrument)
        spot = await _make_spot(db_session, piece)

        await _make_practice_log_with_block_log(
            db_session, test_user, test_instrument,
            spot=spot, practice_date=date(2026, 4, 1),
        )
        await _make_practice_log_with_block_log(
            db_session, test_user, test_instrument,
            spot=spot, practice_date=date(2026, 4, 3),
        )

        resp = await client.get(f"/api/pieces/{piece.id}")
        data = resp.json()
        assert data["session_count"] == 2
        assert data["last_practiced_at"] == "2026-04-03"


# ===================================================================
# SPOTS
# ===================================================================

class TestCreateSpot:
    async def test_create_basic(
        self, client: AsyncClient, db_session, test_instrument
    ):
        piece = await _make_piece(db_session, test_instrument)
        resp = await client.post(
            f"/api/pieces/{piece.id}/spots",
            json={"name": "first page"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "first page"
        assert data["location"] is None
        assert data["display_order"] == 0
        assert data["retired_at"] is None
        assert data["session_count"] == 0

    async def test_create_with_location(
        self, client: AsyncClient, db_session, test_instrument
    ):
        piece = await _make_piece(db_session, test_instrument)
        resp = await client.post(
            f"/api/pieces/{piece.id}/spots",
            json={"name": "trouble spots", "location": "mm. 24-28"},
        )
        assert resp.status_code == 201
        assert resp.json()["location"] == "mm. 24-28"

    async def test_auto_increments_display_order(
        self, client: AsyncClient, db_session, test_instrument
    ):
        piece = await _make_piece(db_session, test_instrument)
        resp1 = await client.post(
            f"/api/pieces/{piece.id}/spots", json={"name": "spot A"}
        )
        resp2 = await client.post(
            f"/api/pieces/{piece.id}/spots", json={"name": "spot B"}
        )
        assert resp1.json()["display_order"] == 0
        assert resp2.json()["display_order"] == 1

    async def test_empty_name_returns_422(
        self, client: AsyncClient, db_session, test_instrument
    ):
        piece = await _make_piece(db_session, test_instrument)
        resp = await client.post(
            f"/api/pieces/{piece.id}/spots", json={"name": ""}
        )
        assert resp.status_code == 422

    async def test_cannot_create_on_other_users_piece(
        self, client: AsyncClient, db_session, other_user
    ):
        other_inst = await _make_instrument(db_session, other_user)
        other_piece = await _make_piece(db_session, other_inst)
        resp = await client.post(
            f"/api/pieces/{other_piece.id}/spots", json={"name": "no"}
        )
        assert resp.status_code == 404


class TestUpdateSpot:
    async def test_update_name(
        self, client: AsyncClient, db_session, test_instrument
    ):
        piece = await _make_piece(db_session, test_instrument)
        spot = await _make_spot(db_session, piece, "old name")
        resp = await client.patch(
            f"/api/spots/{spot.id}", json={"name": "new name"}
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "new name"

    async def test_update_location(
        self, client: AsyncClient, db_session, test_instrument
    ):
        piece = await _make_piece(db_session, test_instrument)
        spot = await _make_spot(db_session, piece)
        resp = await client.patch(
            f"/api/spots/{spot.id}", json={"location": "mm. 1-16"}
        )
        assert resp.status_code == 200
        assert resp.json()["location"] == "mm. 1-16"

    async def test_location_too_long_returns_422(
        self, client: AsyncClient, db_session, test_instrument
    ):
        piece = await _make_piece(db_session, test_instrument)
        spot = await _make_spot(db_session, piece)
        resp = await client.patch(
            f"/api/spots/{spot.id}", json={"location": "x" * 301}
        )
        assert resp.status_code == 422

    async def test_not_found(self, client: AsyncClient):
        resp = await client.patch("/api/spots/99999", json={"name": "X"})
        assert resp.status_code == 404

    async def test_cannot_update_other_users_spot(
        self, client: AsyncClient, db_session, other_user
    ):
        other_inst = await _make_instrument(db_session, other_user)
        other_piece = await _make_piece(db_session, other_inst)
        other_spot = await _make_spot(db_session, other_piece)
        resp = await client.patch(
            f"/api/spots/{other_spot.id}", json={"name": "stolen"}
        )
        assert resp.status_code == 404


class TestRetireSpot:
    async def test_retire_sets_retired_at(
        self, client: AsyncClient, db_session, test_instrument
    ):
        piece = await _make_piece(db_session, test_instrument)
        spot = await _make_spot(db_session, piece)

        resp = await client.post(f"/api/spots/{spot.id}/retire")
        assert resp.status_code == 200
        assert resp.json()["retired_at"] is not None

    async def test_retire_does_not_affect_block_logs(
        self, client: AsyncClient, db_session, test_user, test_instrument
    ):
        """Retiring a spot should NOT alter block_logs or template_block_spots.
        This is distinct from deleting."""
        piece = await _make_piece(db_session, test_instrument)
        spot = await _make_spot(db_session, piece)

        _, bl = await _make_practice_log_with_block_log(
            db_session, test_user, test_instrument, spot=spot
        )

        await client.post(f"/api/spots/{spot.id}/retire")

        await db_session.refresh(bl)
        # block_log still references the spot
        assert bl.spot_id == spot.id
        assert bl.block_name is not None

    async def test_retire_does_not_affect_template_block_spots(
        self, client: AsyncClient, db_session, test_user, test_instrument
    ):
        """Retiring should leave template_block_spots rows intact."""
        piece = await _make_piece(db_session, test_instrument)
        spot = await _make_spot(db_session, piece)

        # Create a template with a repertoire block that references this spot
        template = Template(
            user_id=test_user.id,
            instrument_id=test_instrument.id,
            name="Test Plan",
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

        section = Section(
            template_session_id=ts.id,
            name="Repertoire",
            section_type="repertoire",
        )
        db_session.add(section)
        await db_session.commit()
        await db_session.refresh(section)

        block = Block(
            section_id=section.id,
            piece_id=piece.id,
            display_order=0,
        )
        db_session.add(block)
        await db_session.commit()
        await db_session.refresh(block)

        tbs = TemplateBlockSpot(
            block_id=block.id, spot_id=spot.id, display_order=0
        )
        db_session.add(tbs)
        await db_session.commit()
        await db_session.refresh(tbs)

        # Retire the spot
        await client.post(f"/api/spots/{spot.id}/retire")

        # template_block_spots row should still exist
        await db_session.refresh(tbs)
        assert tbs.spot_id == spot.id

    async def test_not_found(self, client: AsyncClient):
        resp = await client.post("/api/spots/99999/retire")
        assert resp.status_code == 404


class TestUnretireSpot:
    async def test_unretire_clears_retired_at(
        self, client: AsyncClient, db_session, test_instrument
    ):
        piece = await _make_piece(db_session, test_instrument)
        spot = await _make_spot(db_session, piece)
        spot.retired_at = utcnow()
        db_session.add(spot)
        await db_session.commit()

        resp = await client.post(f"/api/spots/{spot.id}/unretire")
        assert resp.status_code == 200
        assert resp.json()["retired_at"] is None


class TestDeleteSpot:
    async def test_soft_deletes_spot(
        self, client: AsyncClient, db_session, test_instrument
    ):
        piece = await _make_piece(db_session, test_instrument)
        spot = await _make_spot(db_session, piece)

        resp = await client.delete(f"/api/spots/{spot.id}")
        assert resp.status_code == 204

        await db_session.refresh(spot)
        assert spot.deleted_at is not None

    async def test_deleted_spot_excluded_from_piece_detail(
        self, client: AsyncClient, db_session, test_instrument
    ):
        piece = await _make_piece(db_session, test_instrument)
        spot = await _make_spot(db_session, piece)

        await client.delete(f"/api/spots/{spot.id}")

        resp = await client.get(f"/api/pieces/{piece.id}")
        assert len(resp.json()["spots"]) == 0

    async def test_block_log_preserves_name_after_spot_delete(
        self, client: AsyncClient, db_session, test_user, test_instrument
    ):
        """Soft-deleting a spot sets deleted_at. The block_log keeps spot_id
        (since this is soft-delete, not hard-delete) and block_name is
        preserved as-is."""
        piece = await _make_piece(db_session, test_instrument)
        spot = await _make_spot(db_session, piece, "trouble spots")

        _, bl = await _make_practice_log_with_block_log(
            db_session, test_user, test_instrument, spot=spot
        )
        original_name = bl.block_name

        await client.delete(f"/api/spots/{spot.id}")

        await db_session.refresh(bl)
        assert bl.block_name == original_name
        # spot_id is still set (soft-delete doesn't trigger ON DELETE SET NULL)
        assert bl.spot_id == spot.id

    async def test_not_found(self, client: AsyncClient):
        resp = await client.delete("/api/spots/99999")
        assert resp.status_code == 404


class TestReorderSpots:
    async def test_reorder(
        self, client: AsyncClient, db_session, test_instrument
    ):
        piece = await _make_piece(db_session, test_instrument)
        s1 = await _make_spot(db_session, piece, "A", order=0)
        s2 = await _make_spot(db_session, piece, "B", order=1)
        s3 = await _make_spot(db_session, piece, "C", order=2)

        resp = await client.put(
            f"/api/pieces/{piece.id}/spots/reorder",
            json={"spot_ids": [s3.id, s1.id, s2.id]},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert [s["name"] for s in data] == ["C", "A", "B"]
        assert [s["display_order"] for s in data] == [0, 1, 2]

    async def test_reorder_mismatched_ids_returns_400(
        self, client: AsyncClient, db_session, test_instrument
    ):
        piece = await _make_piece(db_session, test_instrument)
        s1 = await _make_spot(db_session, piece, "A")

        resp = await client.put(
            f"/api/pieces/{piece.id}/spots/reorder",
            json={"spot_ids": [s1.id, 99999]},
        )
        assert resp.status_code == 400

    async def test_reorder_duplicate_ids_returns_422(
        self, client: AsyncClient, db_session, test_instrument
    ):
        piece = await _make_piece(db_session, test_instrument)
        s1 = await _make_spot(db_session, piece, "A")

        resp = await client.put(
            f"/api/pieces/{piece.id}/spots/reorder",
            json={"spot_ids": [s1.id, s1.id]},
        )
        assert resp.status_code == 422

    async def test_cannot_reorder_other_users_piece(
        self, client: AsyncClient, db_session, other_user
    ):
        other_inst = await _make_instrument(db_session, other_user)
        other_piece = await _make_piece(db_session, other_inst)
        resp = await client.put(
            f"/api/pieces/{other_piece.id}/spots/reorder",
            json={"spot_ids": []},
        )
        assert resp.status_code == 404


class TestSpotHistory:
    async def test_empty_history(
        self, client: AsyncClient, db_session, test_instrument
    ):
        piece = await _make_piece(db_session, test_instrument)
        spot = await _make_spot(db_session, piece)

        resp = await client.get(f"/api/spots/{spot.id}/history")
        assert resp.status_code == 200
        data = resp.json()
        assert data["logs"] == []
        assert data["rating_trend"] == {
            "step_back": 0, "steady": 0, "step_forward": 0, "skipped": 0
        }

    async def test_history_with_logs(
        self, client: AsyncClient, db_session, test_user, test_instrument
    ):
        piece = await _make_piece(db_session, test_instrument)
        spot = await _make_spot(db_session, piece)

        await _make_practice_log_with_block_log(
            db_session, test_user, test_instrument,
            spot=spot, rating=1, notes="felt good",
            practice_date=date(2026, 4, 1),
        )
        await _make_practice_log_with_block_log(
            db_session, test_user, test_instrument,
            spot=spot, rating=0, practice_date=date(2026, 4, 2),
        )
        await _make_practice_log_with_block_log(
            db_session, test_user, test_instrument,
            spot=spot, rating=-1, practice_date=date(2026, 4, 3),
        )

        resp = await client.get(f"/api/spots/{spot.id}/history")
        data = resp.json()
        assert len(data["logs"]) == 3
        # Most recent first
        assert data["logs"][0]["practice_date"] == "2026-04-03"
        assert data["logs"][0]["rating"] == -1
        assert data["logs"][2]["notes"] == "felt good"
        assert data["rating_trend"] == {
            "step_back": 1, "steady": 1, "step_forward": 1, "skipped": 0
        }

    async def test_excludes_incomplete_sessions(
        self, client: AsyncClient, db_session, test_user, test_instrument
    ):
        piece = await _make_piece(db_session, test_instrument)
        spot = await _make_spot(db_session, piece)

        # In-progress session should not appear in history
        await _make_practice_log_with_block_log(
            db_session, test_user, test_instrument,
            spot=spot, rating=1, status="in_progress",
        )

        resp = await client.get(f"/api/spots/{spot.id}/history")
        assert len(resp.json()["logs"]) == 0

    async def test_not_found(self, client: AsyncClient):
        resp = await client.get("/api/spots/99999/history")
        assert resp.status_code == 404

    async def test_cannot_access_other_users_spot_history(
        self, client: AsyncClient, db_session, other_user
    ):
        other_inst = await _make_instrument(db_session, other_user)
        other_piece = await _make_piece(db_session, other_inst)
        other_spot = await _make_spot(db_session, other_piece)
        resp = await client.get(f"/api/spots/{other_spot.id}/history")
        assert resp.status_code == 404


class TestSpotComputedFields:
    async def test_session_count_and_last_practiced(
        self, client: AsyncClient, db_session, test_user, test_instrument
    ):
        piece = await _make_piece(db_session, test_instrument)
        spot = await _make_spot(db_session, piece)

        await _make_practice_log_with_block_log(
            db_session, test_user, test_instrument,
            spot=spot, practice_date=date(2026, 4, 1),
        )
        await _make_practice_log_with_block_log(
            db_session, test_user, test_instrument,
            spot=spot, practice_date=date(2026, 4, 5),
        )

        resp = await client.get(f"/api/pieces/{piece.id}")
        spot_data = resp.json()["spots"][0]
        assert spot_data["session_count"] == 2
        assert spot_data["last_practiced_at"] == "2026-04-05"


# ===================================================================
# ON DELETE SET NULL — the critical invariant
# ===================================================================

class TestOnDeleteSetNull:
    """Verify that block_logs.spot_id uses ON DELETE SET NULL (not CASCADE).

    This is the most important data integrity invariant in the repertoire
    model. If this were CASCADE, hard-deleting a spot would destroy all
    practice history for that spot. The denormalized block_name field
    exists specifically to survive spot deletion.
    """

    async def test_hard_delete_spot_sets_null_preserves_block_log(
        self, db_session: AsyncSession, test_user, test_instrument
    ):
        """When a spot row is hard-deleted from the DB, block_logs.spot_id
        is set to NULL but the block_log row and block_name survive."""
        piece = await _make_piece(db_session, test_instrument)
        spot = await _make_spot(db_session, piece, "doomed spot")

        _, bl = await _make_practice_log_with_block_log(
            db_session, test_user, test_instrument, spot=spot
        )
        block_log_id = bl.id
        original_name = bl.block_name

        # Hard-delete the spot (bypassing soft-delete, simulating a DB-level delete).
        # Expire the session cache first so the re-fetch hits the DB.
        from sqlalchemy import text
        await db_session.execute(
            text("DELETE FROM spots WHERE id = :id"), {"id": spot.id}
        )
        await db_session.commit()

        # Expire all cached objects so re-fetch actually queries the DB
        db_session.expire_all()

        # Re-fetch the block log
        result = await db_session.exec(
            select(BlockLog).where(BlockLog.id == block_log_id)
        )
        refreshed_bl = result.one()

        # Block log still exists
        assert refreshed_bl is not None
        # spot_id is now NULL (ON DELETE SET NULL)
        assert refreshed_bl.spot_id is None
        # block_name is preserved
        assert refreshed_bl.block_name == original_name
