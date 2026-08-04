"""Unit tests for instrument name → canonical category derivation."""
import pytest

from app.services.instrument_category import (
    CANONICAL_INSTRUMENT_CATEGORIES,
    derive_instrument_category,
    normalize_instrument_name,
)


class TestNormalizeInstrumentName:
    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("Violin", "violin"),
            ("  Violin  ", "violin"),
            ("Mom's Violin", "moms violin"),
            ("1/2 size Cello", "1 2 size cello"),
            ("Guitar (nylon)", "guitar nylon"),
            ("Viola   d'amore", "viola damore"),
            ("Mom’s Violin", "moms violin"),  # curly apostrophe too
            ("", ""),
            ("!!!", ""),
        ],
    )
    def test_normalizes(self, raw, expected):
        assert normalize_instrument_name(raw) == expected


class TestDeriveInstrumentCategory:
    @pytest.mark.parametrize("category", CANONICAL_INSTRUMENT_CATEGORIES)
    def test_canonical_names_map_to_themselves(self, category):
        assert derive_instrument_category(category) == category
        assert derive_instrument_category(category.title()) == category

    @pytest.mark.parametrize(
        "name,expected",
        [
            ("Mom's Violin", "violin"),
            ("Backup viola", "viola"),
            ("1/2 size Cello", "cello"),
            ("Grand Piano", "piano"),
            ("Electric guitar", "guitar"),
            ("My flute (student model)", "flute"),
            ("Voice — lessons", "voice"),
            ("VIOLIN #2", "violin"),
            ("violin/practice", "violin"),
        ],
    )
    def test_decorated_names(self, name, expected):
        assert derive_instrument_category(name) == expected

    def test_first_category_wins_when_several_match(self):
        assert derive_instrument_category("Viola and violin") == "viola"

    @pytest.mark.parametrize(
        "name,expected",
        [
            ("Stage Strad", "stage strad"),
            ("Hurdy-gurdy", "hurdy gurdy"),
            ("  Theremin ", "theremin"),
            ("Violins", "violins"),  # only whole words match; no stemming
        ],
    )
    def test_falls_back_to_normalized_name(self, name, expected):
        assert derive_instrument_category(name) == expected

    @pytest.mark.parametrize("name", ["", "   ", "!!!"])
    def test_empty_or_punctuation_only(self, name):
        # No crash, and nothing invented — the stripped, lowercased input.
        assert derive_instrument_category(name) == name.strip().lower()

    def test_seed_categories_are_all_canonical(self):
        """The curated-block seed data must not key off unknown categories."""
        from scripts.seed_curated_blocks import CURATED_BLOCKS

        assert set(CURATED_BLOCKS) <= set(CANONICAL_INSTRUMENT_CATEGORIES)
