import pytest
from temples.services import places_rank as rank

def _r(name, addr=""):
    return {"name": name, "formatted_address": addr}

@pytest.mark.parametrize("q, expected_top", [
    ("浅草神社 神楽殿", "浅草神社"),
    ("浅草 神楽殿", "浅草神社"),
    ("三囲 神楽殿", "三囲神社"),
])
def test_rank_top_is_expected(q, expected_top):
    # “ありがちな候補”を用意（必要最小限）
    candidates = [
        _r("浅草神社", "東京都台東区浅草2-3-1"),
        _r("浅草寺", "東京都台東区浅草2-3-1"),
        _r("三囲神社", "東京都墨田区向島2-5-17"),
        _r("三囲神社神楽殿", "東京都墨田区向島2-5-17"),
        _r("神楽殿", "東京都どこか"),
    ]

    scored = [(rank.score_place(q, r, i), r) for i, r in enumerate(candidates)]
    top = max(scored, key=lambda x: x[0])[1]["name"]
    assert top == expected_top
