"""Tests for suggestions API endpoints."""
from httpx import AsyncClient


class TestGetSuggestions:
    async def test_returns_list(self, client: AsyncClient):
        resp = await client.get("/api/suggestions/")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    async def test_respects_disabled_setting(self, client: AsyncClient):
        # Disable suggestions
        await client.patch("/api/settings/", json={"suggestions_enabled": False})

        resp = await client.get("/api/suggestions/")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_requires_auth(self, unauth_client: AsyncClient):
        resp = await unauth_client.get("/api/suggestions/")
        assert resp.status_code == 401


class TestGetProgress:
    async def test_empty_when_no_templates(self, client: AsyncClient):
        resp = await client.get("/api/suggestions/progress")
        assert resp.status_code == 200
        data = resp.json()
        assert data["exercises"] == []
        assert data["progress"] == []

    async def test_requires_auth(self, unauth_client: AsyncClient):
        resp = await unauth_client.get("/api/suggestions/progress")
        assert resp.status_code == 401


class TestRecordInteraction:
    async def test_record_shown(self, client: AsyncClient):
        resp = await client.post(
            "/api/suggestions/interactions",
            json={
                "suggestion_rule_id": "consistency",
                "suggestion_text": "It's been 5 days since your last practice.",
                "interaction_type": "shown",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["suggestion_rule_id"] == "consistency"
        assert data["interaction_type"] == "shown"
        assert "id" in data
        assert "created_at" in data

    async def test_record_dismissed(self, client: AsyncClient):
        resp = await client.post(
            "/api/suggestions/interactions",
            json={
                "suggestion_rule_id": "balance",
                "suggestion_text": "Try balancing your practice more.",
                "interaction_type": "dismissed",
                "instrument_id": None,
            },
        )
        assert resp.status_code == 201
        assert resp.json()["interaction_type"] == "dismissed"

    async def test_record_acted_on(self, client: AsyncClient):
        resp = await client.post(
            "/api/suggestions/interactions",
            json={
                "suggestion_rule_id": "warmup",
                "suggestion_text": "Consider adding a warm-up.",
                "interaction_type": "acted_on",
            },
        )
        assert resp.status_code == 201
        assert resp.json()["interaction_type"] == "acted_on"

    async def test_with_instrument_id(
        self, client: AsyncClient, test_instrument,
    ):
        resp = await client.post(
            "/api/suggestions/interactions",
            json={
                "suggestion_rule_id": "duration",
                "suggestion_text": "Your sessions are getting shorter.",
                "interaction_type": "shown",
                "instrument_id": test_instrument.id,
            },
        )
        assert resp.status_code == 201
        assert resp.json()["instrument_id"] == test_instrument.id

    async def test_invalid_interaction_type(self, client: AsyncClient):
        resp = await client.post(
            "/api/suggestions/interactions",
            json={
                "suggestion_rule_id": "consistency",
                "suggestion_text": "Test",
                "interaction_type": "invalid_type",
            },
        )
        assert resp.status_code == 400
        assert "interaction_type" in resp.json()["detail"]

    async def test_requires_auth(self, unauth_client: AsyncClient):
        resp = await unauth_client.post(
            "/api/suggestions/interactions",
            json={
                "suggestion_rule_id": "consistency",
                "suggestion_text": "Test",
                "interaction_type": "shown",
            },
        )
        assert resp.status_code == 401


class TestDismissSuggestion:
    async def test_dismiss_returns_success(self, client: AsyncClient):
        resp = await client.post("/api/suggestions/dismiss/some_key")
        assert resp.status_code == 200
        assert resp.json()["status"] == "dismissed"
        assert resp.json()["suggestion_key"] == "some_key"


class TestAcceptSuggestion:
    async def test_accept_missing_fields(self, client: AsyncClient):
        resp = await client.post(
            "/api/suggestions/accept/some_key",
            json={},
        )
        assert resp.status_code == 400

    async def test_accept_nonexistent_exercise(self, client: AsyncClient):
        resp = await client.post(
            "/api/suggestions/accept/some_key",
            json={"exercise_id": 99999, "field": "tempo_bpm", "value": 120},
        )
        assert resp.status_code == 404

    async def test_accept_disallowed_field(
        self, client: AsyncClient, test_template, test_block_type
    ):
        # Create an exercise to test against
        block_resp = await client.post(
            f"/api/templates/{test_template.id}/days/1/blocks",
            json={"block_type_id": test_block_type.id},
        )
        block_id = block_resp.json()["id"]
        ex_resp = await client.post(
            f"/api/templates/{test_template.id}/days/1/blocks/{block_id}/exercises",
            json={"exercise_text": "Test exercise"},
        )
        ex_id = ex_resp.json()["id"]

        resp = await client.post(
            "/api/suggestions/accept/some_key",
            json={"exercise_id": ex_id, "field": "exercise_text", "value": "hacked"},
        )
        assert resp.status_code == 400
        assert "Cannot update field" in resp.json()["detail"]

    async def test_accept_valid_update(
        self, client: AsyncClient, test_template, test_block_type
    ):
        block_resp = await client.post(
            f"/api/templates/{test_template.id}/days/1/blocks",
            json={"block_type_id": test_block_type.id},
        )
        block_id = block_resp.json()["id"]
        ex_resp = await client.post(
            f"/api/templates/{test_template.id}/days/1/blocks/{block_id}/exercises",
            json={"exercise_text": "Test exercise", "tempo_bpm": 80},
        )
        ex_id = ex_resp.json()["id"]

        resp = await client.post(
            "/api/suggestions/accept/tempo_key",
            json={"exercise_id": ex_id, "field": "tempo_bpm", "value": 100},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "accepted"
        assert resp.json()["exercise"]["tempo_bpm"] == 100
