import pytest

from temples.api_views_concierge import _dedupe_candidates


@pytest.mark.parametrize(
    "items,expected_len",
    [
        (
            [
                {"place_id": "abc", "name": "神社A"},
                {"place_id": "abc", "name": "神社A"},
            ],
            1,
        ),
        (
            [
                {"shrine_id": 1, "name": "神社A"},
                {"id": 1, "name": "神社A"},
            ],
            1,
        ),
        (
            [
                {"name": "神社A", "address": "東京"},
                {"name": "神社A", "address": "東京"},
            ],
            1,
        ),
    ],
)
def test_dedupe_candidates_removes_duplicates(items, expected_len):
    """
    同一候補は dedupe により1件になる
    """
    out = _dedupe_candidates(items)

    assert len(out) == expected_len


def test_dedupe_candidates_keeps_different_address():
    """
    同名でも住所が違えば別候補として残る
    """
    items = [
        {"name": "神社A", "address": "東京"},
        {"name": "神社A", "address": "大阪"},
    ]

    out = _dedupe_candidates(items)

    assert len(out) == 2


def test_dedupe_candidates_prefers_first_item():
    """
    重複時は先に来た候補を保持する
    """
    items = [
        {"place_id": "abc", "name": "神社A", "source": "user"},
        {"place_id": "abc", "name": "神社A", "source": "built"},
    ]

    out = _dedupe_candidates(items)

    assert len(out) == 1
    assert out[0]["source"] == "user"
