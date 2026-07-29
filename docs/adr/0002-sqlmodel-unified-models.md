# ADR-0002 — SQLModel for unified ORM + schema models

- **Status:** Accepted
- **Date:** Reconstructed 2026-07-28 (original decision predates this record)

## Context

The backend needs both database models (SQLAlchemy ORM) and API request/response
schemas (Pydantic). Maintaining these as two parallel class hierarchies is
repetitive and drifts easily.

## Decision

Use **SQLModel** — a single class definition serves as both the SQLAlchemy table
model and the Pydantic schema. Models live in `app/models/`.

## Rationale

- One source of truth per entity instead of a model class plus a mirror schema
  class kept in sync by hand.
- Built by FastAPI's author on top of SQLAlchemy + Pydantic, so it composes
  naturally with FastAPI's validation and dependency system.
- Async support via `sqlmodel.ext.asyncio.session.AsyncSession`, consistent with
  ADR-0001.

## Alternatives considered

- **SQLAlchemy Core/ORM + Pydantic, separately** — the conventional split; more
  boilerplate and two things to keep aligned. *(Reconstructed.)*
- **Tortoise ORM / other async ORMs** — less mainstream tooling and migration
  support than the SQLAlchemy/Alembic ecosystem. *(Reconstructed.)*

## Consequences

- SQLModel is a thinner layer over SQLAlchemy; where we need Core features
  (e.g. `INSERT ... ON CONFLICT`, `update()` statements) we drop to SQLAlchemy
  Core and run it via `session.exec(...)`. That's expected, not a smell.
- Ties us to the SQLAlchemy/Alembic ecosystem for migrations (ADR-0004).
