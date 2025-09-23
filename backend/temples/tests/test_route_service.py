import pytest
from temples.route_service import Point, build_route


@pytest.mark.parametrize("mode", ["walking", "driving"])
def test_build_route_returns_legs_and_totals(mode):
    origin = Point(lat=35.68, lng=139.76)  # 東京駅あたり
    destinations = [
        Point(lat=35.67, lng=139.71),  # 目的地1
        Point(lat=35.66, lng=139.70),  # 目的地2
    ]

    result = build_route(mode, origin, destinations)

    assert result["mode"] == mode
    assert result["provider"] in {"dummy", "mapbox", "google"}
    assert isinstance(result["legs"], list) and len(result["legs"]) == len(destinations)

    # 各 leg の基本形を確認
    for leg in result["legs"]:
        assert set(leg.keys()) == {"from", "to", "distance_m", "duration_s", "geometry"}
        assert isinstance(leg["distance_m"], int) and leg["distance_m"] >= 0
        assert isinstance(leg["duration_s"], int) and leg["duration_s"] >= 0
        assert isinstance(leg["geometry"], list) and len(leg["geometry"]) >= 2
        # [[lat, lng], ...] の形を軽く検査
        first = leg["geometry"][0]
        assert isinstance(first, (list, tuple)) and len(first) == 2

    # 合計値が 0 より大きい
    assert result["distance_m_total"] > 0
    assert result["duration_s_total"] > 0
