"""Tests for repertoire block creation and default-spots management.

Covers creating repertoire blocks, the 3 default-spot endpoints,
the check constraint, spot ownership validation, and the template
detail response with repertoire data.
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
async def hierarchy_with_piece(db_session: AsyncSession, test_user, test_instrument):
    """Template → session → section, plus a piece with 3 spots."""
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

    section = Section(
        template_session_id=ts.id,
        name="Repertoire",
        section_type="repertoire",
        estimated_duration_minutes=15,
        display_order=0,
    )
    db_session.add(section)
    await db_session.commit()
    await db_session.refresh(section)

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
        spot = Spot(
            piece_id=piece.id, name=name, location=loc, display_order=i
        )
        db_session.add(spot)
        await db_session.commit()
        await db_session.refresh(spot)
        spots.append(spot)

    return template, ts, section, piece, spots


# ===================================================================
# CREATE REPERTOIRE BLOCK
# ===================================================================

class TestCreateRepertoireBlock:
    async def test_create_with_piece_id(
        self, client: AsyncClient, hierarchy_with_piece
    ):
        template, ts, section, piece, spots = hierarchy_with_piece
        resp = await client.post(
            f"/api/sections/{section.id}/blocks",
            json={"piece_id": piece.id},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["piece_id"] == piece.id
        assert data["piece_name"] == "Bruch Concerto"
        assert data["name"] is None
        assert data["default_spots"] == []
        assert data["display_order"] == 0

    async def test_create_with_default_spot_ids(
        self, client: AsyncClient, hierarchy_with_piece
    ):
        template, ts, section, piece, spots = hierarchy_with_piece
        resp = await client.post(
            f"/api/sections/{section.id}/blocks",
            json={
                "piece_id": piece.id,
                "default_spot_ids": [spots[0].id, spots[2].id],
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert len(data["default_spots"]) == 2
        assert data["default_spots"][0]["name"] == "first page"
        assert data["default_spots"][0]["location"] == "mm. 1-32"
        assert data["default_spots"][0]["display_order"] == 0
        assert data["default_spots"][1]["name"] == "trouble spots"
        assert data["default_spots"][1]["display_order"] == 1

    async def test_create_with_all_spots(
        self, client: AsyncClient, hierarchy_with_piece
    ):
        template, ts, section, piece, spots = hierarchy_with_piece
        resp = await client.post(
            f"/api/sections/{section.id}/blocks",
            json={
                "piece_id": piece.id,
                "default_spot_ids": [s.id for s in spots],
            },
        )
        assert resp.status_code == 201
        assert len(resp.json()["default_spots"]) == 3

    async def test_rejects_both_piece_id_and_curated_block_id(
        self, client: AsyncClient, hierarchy_with_piece
    ):
        template, ts, section, piece, spots = hierarchy_with_piece
        resp = await client.post(
            f"/api/sections/{section.id}/blocks",
            json={"piece_id": piece.id, "curated_block_id": 1},
        )
        assert resp.status_code == 422

    async def test_rejects_piece_from_wrong_instrument(
        self, client: AsyncClient, db_session, test_user, hierarchy_with_piece
    ):
        template, ts, section, piece, spots = hierarchy_with_piece
        # Create another instrument + piece
        other_inst = Instrument(user_id=test_user.id, name="Piano")
        db_session.add(other_inst)
        await db_session.commit()
        await db_session.refresh(other_inst)

        other_piece = Piece(instrument_id=other_inst.id, name="Chopin Ballade")
        db_session.add(other_piece)
        await db_session.commit()
        await db_session.refresh(other_piece)

        resp = await client.post(
            f"/api/sections/{section.id}/blocks",
            json={"piece_id": other_piece.id},
        )
        assert resp.status_code == 404

    async def test_rejects_spot_from_wrong_piece(
        self, client: AsyncClient, db_session, hierarchy_with_piece
    ):
        template, ts, section, piece, spots = hierarchy_with_piece
        # Create a spot on a different piece
        other_piece = Piece(
            instrument_id=piece.instrument_id, name="Bach Partita"
        )
        db_session.add(other_piece)
        await db_session.commit()
        await db_session.refresh(other_piece)

        other_spot = Spot(piece_id=other_piece.id, name="Allemande")
        db_session.add(other_spot)
        await db_session.commit()
        await db_session.refresh(other_spot)

        resp = await client.post(
            f"/api/sections/{section.id}/blocks",
            json={
                "piece_id": piece.id,
                "default_spot_ids": [other_spot.id],
            },
        )
        assert resp.status_code == 400

    async def test_standard_block_still_works(
        self, client: AsyncClient, hierarchy_with_piece
    ):
        template, ts, section, piece, spots = hierarchy_with_piece
        resp = await client.post(
            f"/api/sections/{section.id}/blocks",
            json={"name": "Open strings"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Open strings"
        assert data["piece_id"] is None
        assert data["piece_name"] is None
        assert data["default_spots"] is None

    async def test_standard_block_requires_name(
        self, client: AsyncClient, hierarchy_with_piece
    ):
        template, ts, section, piece, spots = hierarchy_with_piece
        resp = await client.post(
            f"/api/sections/{section.id}/blocks",
            json={},
        )
        assert resp.status_code == 422


# ===================================================================
# DEFAULT SPOT MANAGEMENT
# ===================================================================

class TestAddDefaultSpot:
    async def test_add_spot(
        self, client: AsyncClient, db_session, hierarchy_with_piece
    ):
        template, ts, section, piece, spots = hierarchy_with_piece
        # Create a repertoire block with no default spots
        resp = await client.post(
            f"/api/sections/{section.id}/blocks",
            json={"piece_id": piece.id},
        )
        block_id = resp.json()["id"]

        # Add a spot
        resp = await client.post(
            f"/api/blocks/{block_id}/default-spots",
            json={"spot_id": spots[0].id},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert len(data["default_spots"]) == 1
        assert data["default_spots"][0]["name"] == "first page"

    async def test_add_multiple_spots_ordering(
        self, client: AsyncClient, hierarchy_with_piece
    ):
        template, ts, section, piece, spots = hierarchy_with_piece
        resp = await client.post(
            f"/api/sections/{section.id}/blocks",
            json={"piece_id": piece.id},
        )
        block_id = resp.json()["id"]

        await client.post(
            f"/api/blocks/{block_id}/default-spots",
            json={"spot_id": spots[2].id},
        )
        resp = await client.post(
            f"/api/blocks/{block_id}/default-spots",
            json={"spot_id": spots[0].id},
        )
        data = resp.json()
        assert len(data["default_spots"]) == 2
        assert data["default_spots"][0]["display_order"] == 0
        assert data["default_spots"][1]["display_order"] == 1

    async def test_reject_duplicate_spot(
        self, client: AsyncClient, hierarchy_with_piece
    ):
        template, ts, section, piece, spots = hierarchy_with_piece
        resp = await client.post(
            f"/api/sections/{section.id}/blocks",
            json={"piece_id": piece.id, "default_spot_ids": [spots[0].id]},
        )
        block_id = resp.json()["id"]

        resp = await client.post(
            f"/api/blocks/{block_id}/default-spots",
            json={"spot_id": spots[0].id},
        )
        assert resp.status_code == 409

    async def test_reject_spot_from_different_piece(
        self, client: AsyncClient, db_session, hierarchy_with_piece
    ):
        template, ts, section, piece, spots = hierarchy_with_piece
        other_piece = Piece(
            instrument_id=piece.instrument_id, name="Bach Partita"
        )
        db_session.add(other_piece)
        await db_session.commit()
        await db_session.refresh(other_piece)

        other_spot = Spot(piece_id=other_piece.id, name="Sarabande")
        db_session.add(other_spot)
        await db_session.commit()
        await db_session.refresh(other_spot)

        resp = await client.post(
            f"/api/sections/{section.id}/blocks",
            json={"piece_id": piece.id},
        )
        block_id = resp.json()["id"]

        resp = await client.post(
            f"/api/blocks/{block_id}/default-spots",
            json={"spot_id": other_spot.id},
        )
        assert resp.status_code == 400

    async def test_reject_on_standard_block(
        self, client: AsyncClient, hierarchy_with_piece
    ):
        template, ts, section, piece, spots = hierarchy_with_piece
        resp = await client.post(
            f"/api/sections/{section.id}/blocks",
            json={"name": "Scales"},
        )
        block_id = resp.json()["id"]

        resp = await client.post(
            f"/api/blocks/{block_id}/default-spots",
            json={"spot_id": spots[0].id},
        )
        assert resp.status_code == 400


class TestRemoveDefaultSpot:
    async def test_remove_spot(
        self, client: AsyncClient, hierarchy_with_piece
    ):
        template, ts, section, piece, spots = hierarchy_with_piece
        resp = await client.post(
            f"/api/sections/{section.id}/blocks",
            json={
                "piece_id": piece.id,
                "default_spot_ids": [spots[0].id, spots[1].id, spots[2].id],
            },
        )
        block_id = resp.json()["id"]

        resp = await client.delete(
            f"/api/blocks/{block_id}/default-spots/{spots[1].id}"
        )
        assert resp.status_code == 204

        # Verify the spot is gone from the default list
        resp = await client.get(f"/api/blocks/{block_id}/default-spots/reorder")
        # Just check via template detail
        resp = await client.get(f"/api/templates/{template.id}")
        blocks = resp.json()["sessions"][0]["sections"][0]["blocks"]
        rep_block = [b for b in blocks if b["piece_id"] == piece.id][0]
        assert len(rep_block["default_spots"]) == 2
        spot_names = [s["name"] for s in rep_block["default_spots"]]
        assert "development" not in spot_names

    async def test_remove_reorders_remaining(
        self, client: AsyncClient, db_session, hierarchy_with_piece
    ):
        template, ts, section, piece, spots = hierarchy_with_piece
        resp = await client.post(
            f"/api/sections/{section.id}/blocks",
            json={
                "piece_id": piece.id,
                "default_spot_ids": [spots[0].id, spots[1].id, spots[2].id],
            },
        )
        block_id = resp.json()["id"]

        # Remove the first spot
        await client.delete(
            f"/api/blocks/{block_id}/default-spots/{spots[0].id}"
        )

        # Remaining spots should be reordered 0, 1
        resp = await client.get(f"/api/templates/{template.id}")
        blocks = resp.json()["sessions"][0]["sections"][0]["blocks"]
        rep_block = [b for b in blocks if b["piece_id"] == piece.id][0]
        orders = [s["display_order"] for s in rep_block["default_spots"]]
        assert orders == [0, 1]

    async def test_remove_does_not_retire_or_delete_spot(
        self, client: AsyncClient, hierarchy_with_piece
    ):
        """Removing from default list must NOT affect the spot itself."""
        template, ts, section, piece, spots = hierarchy_with_piece
        resp = await client.post(
            f"/api/sections/{section.id}/blocks",
            json={
                "piece_id": piece.id,
                "default_spot_ids": [spots[0].id],
            },
        )
        block_id = resp.json()["id"]

        await client.delete(
            f"/api/blocks/{block_id}/default-spots/{spots[0].id}"
        )

        # Spot should still exist and be active
        resp = await client.get(f"/api/pieces/{piece.id}")
        spot_data = resp.json()["spots"]
        spot_names = [s["name"] for s in spot_data]
        assert "first page" in spot_names
        first_page = [s for s in spot_data if s["name"] == "first page"][0]
        assert first_page["retired_at"] is None

    async def test_remove_nonexistent_returns_404(
        self, client: AsyncClient, hierarchy_with_piece
    ):
        template, ts, section, piece, spots = hierarchy_with_piece
        resp = await client.post(
            f"/api/sections/{section.id}/blocks",
            json={"piece_id": piece.id},
        )
        block_id = resp.json()["id"]

        resp = await client.delete(
            f"/api/blocks/{block_id}/default-spots/{spots[0].id}"
        )
        assert resp.status_code == 404


class TestReorderDefaultSpots:
    async def test_reorder(
        self, client: AsyncClient, hierarchy_with_piece
    ):
        template, ts, section, piece, spots = hierarchy_with_piece
        resp = await client.post(
            f"/api/sections/{section.id}/blocks",
            json={
                "piece_id": piece.id,
                "default_spot_ids": [spots[0].id, spots[1].id, spots[2].id],
            },
        )
        block_id = resp.json()["id"]

        resp = await client.put(
            f"/api/blocks/{block_id}/default-spots/reorder",
            json={"spot_ids": [spots[2].id, spots[0].id, spots[1].id]},
        )
        assert resp.status_code == 200
        ds = resp.json()["default_spots"]
        assert [s["name"] for s in ds] == [
            "trouble spots", "first page", "development"
        ]
        assert [s["display_order"] for s in ds] == [0, 1, 2]

    async def test_reorder_mismatched_ids_returns_400(
        self, client: AsyncClient, hierarchy_with_piece
    ):
        template, ts, section, piece, spots = hierarchy_with_piece
        resp = await client.post(
            f"/api/sections/{section.id}/blocks",
            json={
                "piece_id": piece.id,
                "default_spot_ids": [spots[0].id],
            },
        )
        block_id = resp.json()["id"]

        resp = await client.put(
            f"/api/blocks/{block_id}/default-spots/reorder",
            json={"spot_ids": [spots[0].id, spots[1].id]},
        )
        assert resp.status_code == 400

    async def test_reject_on_standard_block(
        self, client: AsyncClient, hierarchy_with_piece
    ):
        template, ts, section, piece, spots = hierarchy_with_piece
        resp = await client.post(
            f"/api/sections/{section.id}/blocks",
            json={"name": "Scales"},
        )
        block_id = resp.json()["id"]

        resp = await client.put(
            f"/api/blocks/{block_id}/default-spots/reorder",
            json={"spot_ids": []},
        )
        assert resp.status_code == 400


# ===================================================================
# TEMPLATE DETAIL RESPONSE
# ===================================================================

class TestTemplateDetailWithRepertoireBlocks:
    async def test_includes_piece_name_and_default_spots(
        self, client: AsyncClient, hierarchy_with_piece
    ):
        template, ts, section, piece, spots = hierarchy_with_piece
        await client.post(
            f"/api/sections/{section.id}/blocks",
            json={
                "piece_id": piece.id,
                "default_spot_ids": [spots[0].id, spots[1].id],
            },
        )

        resp = await client.get(f"/api/templates/{template.id}")
        assert resp.status_code == 200
        blocks = resp.json()["sessions"][0]["sections"][0]["blocks"]
        assert len(blocks) == 1
        b = blocks[0]
        assert b["piece_id"] == piece.id
        assert b["piece_name"] == "Bruch Concerto"
        assert len(b["default_spots"]) == 2
        assert b["default_spots"][0]["name"] == "first page"
        assert b["default_spots"][0]["location"] == "mm. 1-32"

    async def test_standard_block_has_null_repertoire_fields(
        self, client: AsyncClient, hierarchy_with_piece
    ):
        template, ts, section, piece, spots = hierarchy_with_piece
        await client.post(
            f"/api/sections/{section.id}/blocks",
            json={"name": "Warm-up scales"},
        )

        resp = await client.get(f"/api/templates/{template.id}")
        blocks = resp.json()["sessions"][0]["sections"][0]["blocks"]
        b = blocks[0]
        assert b["piece_id"] is None
        assert b["piece_name"] is None
        assert b["default_spots"] is None

    async def test_mixed_blocks_in_section(
        self, client: AsyncClient, hierarchy_with_piece
    ):
        template, ts, section, piece, spots = hierarchy_with_piece
        # Standard block
        await client.post(
            f"/api/sections/{section.id}/blocks",
            json={"name": "Long tones"},
        )
        # Repertoire block
        await client.post(
            f"/api/sections/{section.id}/blocks",
            json={
                "piece_id": piece.id,
                "default_spot_ids": [spots[0].id],
            },
        )

        resp = await client.get(f"/api/templates/{template.id}")
        blocks = resp.json()["sessions"][0]["sections"][0]["blocks"]
        assert len(blocks) == 2
        assert blocks[0]["piece_id"] is None
        assert blocks[0]["name"] == "Long tones"
        assert blocks[1]["piece_id"] == piece.id
        assert blocks[1]["piece_name"] == "Bruch Concerto"
