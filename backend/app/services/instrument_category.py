"""
Canonical instrument categories and name → category derivation.

Users name their instruments freely ("Mom's Violin", "Backup viola", "Stage
Strad"), but the curated block library is keyed by a canonical category
("violin"). This module owns that canonical list — the curated-block seed data
validates its keys against it — plus the normalization used when creating
instruments and when backfilling existing rows.
"""
import re
from typing import Tuple

# The canonical categories the curated block library is keyed by. This is the
# single source of truth: scripts/seed_curated_blocks.py validates CURATED_BLOCKS
# against it rather than defining its own list.
CANONICAL_INSTRUMENT_CATEGORIES: Tuple[str, ...] = (
    "violin",
    "viola",
    "cello",
    "piano",
    "guitar",
    "flute",
    "voice",
)

_CANONICAL_SET = frozenset(CANONICAL_INSTRUMENT_CATEGORIES)

# Apostrophes are dropped rather than split on, so "Mom's" stays one word.
_APOSTROPHES = re.compile(r"['‘’]")
# Everything else that isn't a letter or digit is a word separator: hyphens,
# slashes, parentheses, sizes like "1/2".
_SEPARATORS = re.compile(r"[^a-z0-9]+")


def normalize_instrument_name(name: str) -> str:
    """Lowercase a name, replace punctuation with spaces, collapse whitespace."""
    stripped = _APOSTROPHES.sub("", (name or "").lower())
    return _SEPARATORS.sub(" ", stripped).strip()


def derive_instrument_category(name: str) -> str:
    """Derive the canonical category for a user-supplied instrument name.

    Matches a canonical category appearing as a word anywhere in the name, so
    decoration around it is tolerated ("Mom's Violin" → "violin", "Backup
    viola" → "viola", "1/2 size Cello" → "cello"). When several appear, the
    first one wins.

    When nothing matches, falls back to the normalized name ("Stage Strad" →
    "stage strad") — no worse than the previous behavior of sending the
    lowercased name straight to the library endpoint.
    """
    normalized = normalize_instrument_name(name)
    if not normalized:
        # Name was empty or pure punctuation; keep whatever the user typed,
        # lowercased, so the value is at least stable.
        return (name or "").strip().lower()

    for token in normalized.split(" "):
        if token in _CANONICAL_SET:
            return token

    return normalized
