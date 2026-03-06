"""Tests for templates API endpoints (templates, days, blocks, exercises)."""
from httpx import AsyncClient


class TestListTemplates:
    async def test_empty_initially(self, client: AsyncClient):
        resp = await client.get("/api/templates/")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_returns_user_templates(self, client: AsyncClient, test_template):
        resp = await client.get("/api/templates/")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        assert any(t["name"] == "Test Practice Rotation" for t in data)

    async def test_filter_by_user_instrument(
        self, client: AsyncClient, test_template, test_user_instrument
    ):
        resp = await client.get(
            f"/api/templates/?user_instrument_id={test_user_instrument.id}"
        )
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    async def test_requires_auth(self, unauth_client: AsyncClient):
        resp = await unauth_client.get("/api/templates/")
        assert resp.status_code == 401


class TestCreateTemplate:
    async def test_create_with_days(self, client: AsyncClient, test_user_instrument):
        resp = await client.post(
            "/api/templates/",
            json={
                "user_instrument_id": test_user_instrument.id,
                "name": "New Template",
                "days_count": 3,
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "New Template"
        assert data["days_count"] == 3
        assert len(data["practice_days"]) == 3

    async def test_invalid_user_instrument(self, client: AsyncClient):
        resp = await client.post(
            "/api/templates/",
            json={
                "user_instrument_id": 99999,
                "name": "Bad Template",
                "days_count": 1,
            },
        )
        assert resp.status_code == 404


class TestGetTemplate:
    async def test_get_with_days(self, client: AsyncClient, test_template):
        resp = await client.get(f"/api/templates/{test_template.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Test Practice Rotation"
        assert len(data["practice_days"]) == 1

    async def test_nonexistent(self, client: AsyncClient):
        resp = await client.get("/api/templates/99999")
        assert resp.status_code == 404


class TestUpdateTemplate:
    async def test_update_name(self, client: AsyncClient, test_template):
        resp = await client.put(
            f"/api/templates/{test_template.id}",
            json={"name": "Renamed Template"},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Renamed Template"

    async def test_increase_days_count(self, client: AsyncClient, test_template):
        resp = await client.put(
            f"/api/templates/{test_template.id}",
            json={"days_count": 3},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["days_count"] == 3
        assert len(data["practice_days"]) == 3

    async def test_decrease_days_count(self, client: AsyncClient, test_template):
        # First increase to 3
        await client.put(
            f"/api/templates/{test_template.id}",
            json={"days_count": 3},
        )
        # Then decrease to 1
        resp = await client.put(
            f"/api/templates/{test_template.id}",
            json={"days_count": 1},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["days_count"] == 1
        assert len(data["practice_days"]) == 1


class TestDeleteTemplate:
    async def test_soft_delete(self, client: AsyncClient, test_template):
        resp = await client.delete(f"/api/templates/{test_template.id}")
        assert resp.status_code == 204

        # Should no longer appear in list
        resp = await client.get("/api/templates/")
        assert not any(t["id"] == test_template.id for t in resp.json())

    async def test_delete_nonexistent(self, client: AsyncClient):
        resp = await client.delete("/api/templates/99999")
        assert resp.status_code == 404


class TestGetPracticeDay:
    async def test_get_day(self, client: AsyncClient, test_template):
        resp = await client.get(f"/api/templates/{test_template.id}/days/1")
        assert resp.status_code == 200
        data = resp.json()
        assert data["day_number"] == 1
        assert data["title"] == "Day 1"

    async def test_nonexistent_day(self, client: AsyncClient, test_template):
        resp = await client.get(f"/api/templates/{test_template.id}/days/99")
        assert resp.status_code == 404


class TestUpdateDay:
    async def test_update_title(self, client: AsyncClient, test_template):
        resp = await client.put(
            f"/api/templates/{test_template.id}/days/1",
            json={"title": "Warm-Up Day"},
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "Warm-Up Day"


class TestBlockCRUD:
    async def test_create_block(self, client: AsyncClient, test_template, test_block_type):
        resp = await client.post(
            f"/api/templates/{test_template.id}/days/1/blocks",
            json={"block_type_id": test_block_type.id, "duration_minutes": 15},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["block_type"] == "warm-up"
        assert data["duration_minutes"] == 15
        assert data["exercises"] == []

    async def test_create_block_invalid_type(self, client: AsyncClient, test_template):
        resp = await client.post(
            f"/api/templates/{test_template.id}/days/1/blocks",
            json={"block_type_id": 99999},
        )
        assert resp.status_code == 400

    async def test_update_block(self, client: AsyncClient, test_template, test_block_type):
        # Create a block first
        create_resp = await client.post(
            f"/api/templates/{test_template.id}/days/1/blocks",
            json={"block_type_id": test_block_type.id},
        )
        block_id = create_resp.json()["id"]

        resp = await client.put(
            f"/api/templates/{test_template.id}/days/1/blocks/{block_id}",
            json={"duration_minutes": 20},
        )
        assert resp.status_code == 200
        assert resp.json()["duration_minutes"] == 20

    async def test_delete_block(self, client: AsyncClient, test_template, test_block_type):
        create_resp = await client.post(
            f"/api/templates/{test_template.id}/days/1/blocks",
            json={"block_type_id": test_block_type.id},
        )
        block_id = create_resp.json()["id"]

        resp = await client.delete(
            f"/api/templates/{test_template.id}/days/1/blocks/{block_id}"
        )
        assert resp.status_code == 204

    async def test_reorder_blocks(self, client: AsyncClient, test_template, test_block_type):
        # Create two blocks
        r1 = await client.post(
            f"/api/templates/{test_template.id}/days/1/blocks",
            json={"block_type_id": test_block_type.id},
        )
        r2 = await client.post(
            f"/api/templates/{test_template.id}/days/1/blocks",
            json={"block_type_id": test_block_type.id},
        )
        id1, id2 = r1.json()["id"], r2.json()["id"]

        # Reverse order
        resp = await client.put(
            f"/api/templates/{test_template.id}/days/1/blocks/reorder",
            json={"block_ids": [id2, id1]},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


class TestExerciseCRUD:
    async def _create_block(self, client, template_id, block_type_id):
        """Helper to create a block and return its ID."""
        resp = await client.post(
            f"/api/templates/{template_id}/days/1/blocks",
            json={"block_type_id": block_type_id},
        )
        return resp.json()["id"]

    async def test_create_exercise(
        self, client: AsyncClient, test_template, test_block_type
    ):
        block_id = await self._create_block(client, test_template.id, test_block_type.id)
        resp = await client.post(
            f"/api/templates/{test_template.id}/days/1/blocks/{block_id}/exercises",
            json={
                "exercise_text": "Scales in G Major",
                "tempo_bpm": 80,
                "key": "G Major",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["exercise_text"] == "Scales in G Major"
        assert data["tempo_bpm"] == 80
        assert data["key"] == "G Major"

    async def test_update_exercise(
        self, client: AsyncClient, test_template, test_block_type
    ):
        block_id = await self._create_block(client, test_template.id, test_block_type.id)
        create_resp = await client.post(
            f"/api/templates/{test_template.id}/days/1/blocks/{block_id}/exercises",
            json={"exercise_text": "Old name"},
        )
        ex_id = create_resp.json()["id"]

        resp = await client.put(
            f"/api/templates/{test_template.id}/days/1/blocks/{block_id}/exercises/{ex_id}",
            json={"exercise_text": "Updated name", "tempo_bpm": 100},
        )
        assert resp.status_code == 200
        assert resp.json()["exercise_text"] == "Updated name"
        assert resp.json()["tempo_bpm"] == 100

    async def test_delete_exercise(
        self, client: AsyncClient, test_template, test_block_type
    ):
        block_id = await self._create_block(client, test_template.id, test_block_type.id)
        create_resp = await client.post(
            f"/api/templates/{test_template.id}/days/1/blocks/{block_id}/exercises",
            json={"exercise_text": "To delete"},
        )
        ex_id = create_resp.json()["id"]

        resp = await client.delete(
            f"/api/templates/{test_template.id}/days/1/blocks/{block_id}/exercises/{ex_id}"
        )
        assert resp.status_code == 204

    async def test_exercise_not_found(
        self, client: AsyncClient, test_template, test_block_type
    ):
        block_id = await self._create_block(client, test_template.id, test_block_type.id)
        resp = await client.put(
            f"/api/templates/{test_template.id}/days/1/blocks/{block_id}/exercises/99999",
            json={"exercise_text": "Doesn't exist"},
        )
        assert resp.status_code == 404
