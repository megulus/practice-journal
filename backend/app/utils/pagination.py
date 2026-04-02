"""Reusable cursor-based pagination helpers."""
import base64
import json
from typing import Optional


def encode_cursor(data: dict) -> str:
    """Encode a dict as an opaque base64 cursor string."""
    return base64.urlsafe_b64encode(json.dumps(data).encode()).decode()


def decode_cursor(cursor: str) -> Optional[dict]:
    """Decode a cursor string back to a dict. Returns None on invalid input."""
    try:
        return json.loads(base64.urlsafe_b64decode(cursor.encode()))
    except (ValueError, json.JSONDecodeError):
        return None
