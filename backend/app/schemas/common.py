"""Validation helpers shared across request schemas."""
from typing import Optional, TypeVar

T = TypeVar("T")


def reject_explicit_null(value: Optional[T]) -> T:
    """Reject an explicit `null` on a field backed by a NOT NULL column.

    PATCH bodies declare every field as `Optional[...] = None` so that omitting
    one means "leave unchanged", but the underlying column is often NOT NULL.
    Routers build their update set with `model_dump(exclude_unset=True)`, and an
    explicitly-passed `null` *is* set — so it survives, gets `setattr` to None,
    and reaches the DB as a not-null violation (500) instead of a 422.

    Attach it per field with `field_validator(...)(reject_explicit_null)`;
    genuinely nullable fields must be left off that list so an explicit `null`
    keeps meaning "clear this field". Pydantic doesn't run validators for
    fields left at their default, so this only fires when the client actually
    sent `null`.
    """
    if value is None:
        raise ValueError("cannot be null; omit the field to leave it unchanged")
    return value
