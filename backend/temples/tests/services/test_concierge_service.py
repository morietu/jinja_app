import types

import pytest
from temples.services.concierge import ConciergeService


@pytest.fixture
def svc(monkeypatch):
    svc = ConciergeService()

    def mock_find_place(*, input, language, locationbias, fields):
        return {
            "results": [
                {
                    "place_id": "PID_MAIN",
                    "name": "浅草神社",
                    "formatted_address": "東京都台東区浅草2-3-1",
                    "geometry": {"location": {"lat": 35.7151665, "lng": 139.7974389}},
                    "rating": 4.5,
                    "user_ratings_total": 4691,
                    "open_now": True,
                    "photo_reference": "PH",
                    "icon": "ICON",
                }
            ]
        }

    def mock_nearby_search(*, location, radius, language, type):
        return {
            "results": [
                {
                    "place_id": "PID_MAIN",
                    "name": "重複",
                    "geometry": {"location": {"lat": 0, "lng": 0}},
                    "rating": 5,
                    "distance_m": 1,
                },
                {
                    "place_id": "ALT_2",
                    "name": "浅草寺",
                    "vicinity": "浅草",
                    "geometry": {"location": {"lat": 35.714, "lng": 139.796}},
                    "rating": 4.7,
                    "user_ratings_total": 10000,
                    "distance_m": 300,
                },
                {
                    "place_id": "ALT_1",
                    "name": "今戸神社",
                    "vicinity": "今戸",
                    "geometry": {"location": {"lat": 35.717, "lng": 139.801}},
                    "rating": 4.4,
                    "user_ratings_total": 2000,
                    "distance_m": 500,
                },
            ]
        }

    svc.places.find_place = types.MethodType(lambda _self, **kw: mock_find_place(**kw), svc.places)
    svc.places.nearby_search = types.MethodType(
        lambda _self, **kw: mock_nearby_search(**kw), svc.places
    )
    return svc


def test_build_plan_rank_and_mode(svc):
    plan = svc.build_plan(
        query="浅草神社",
        language="ja",
        locationbias="circle:1500@35.715,139.797",
        transportation="car",
    )
    assert plan["transportation"] == "car"
    assert plan["route_hints"]["mode"] == "drive"
    assert plan["main"]["place_id"] == "PID_MAIN"
    assert {a["place_id"] for a in plan["alternatives"]} == {"ALT_1", "ALT_2"}


def test_build_plan_no_results(monkeypatch):
    s = ConciergeService()
    s.places.find_place = lambda **kw: {"results": []}
    s.places.nearby_search = lambda **kw: {"results": []}
    plan = s.build_plan(query="x", language="ja", locationbias="", transportation="walk")
    assert plan["main"] is None and plan["alternatives"] == []
    assert plan["route_hints"]["mode"] in ("walk", "drive")
