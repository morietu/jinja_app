from temples.services.concierge_candidate_utils import (
    _candidate_key,
    _dedupe_candidates,
    _normalize_candidate_fields,
    _to_float,
)


def test_to_float_handles_numbers_and_strings():
    assert _to_float(1) == 1.0
    assert _to_float(" 1.5 ") == 1.5
    assert _to_float("") is None
    assert _to_float(None) is None
    assert _to_float("x") is None


def test_candidate_key_prefers_place_id_then_shrine_id_then_name_address():
    assert _candidate_key({"place_id": "pid-1", "shrine_id": 3, "name": "A"}) == (
        "place_id",
        "pid-1",
    )
    assert _candidate_key({"shrine_id": 3, "name": "A"}) == ("shrine_id", "3")
    assert _candidate_key({"name": "A", "formatted_address": "Tokyo"}) == (
        "name_address",
        "A",
        "Tokyo",
    )


def test_dedupe_candidates_keeps_first_item_for_same_key():
    first = {"place_id": "pid-1", "name": "A", "address": "addr-1"}
    second = {"place_id": "pid-1", "name": "B", "address": "addr-2"}

    assert _dedupe_candidates([first, second]) == [first]


def test_normalize_candidate_fields_keeps_distance_m():
    src = {"name": "A", "lat": "35.0", "lng": "139.0", "distance_m": "100"}
    out = _normalize_candidate_fields(src)

    assert out["lat"] == 35.0
    assert out["lng"] == 139.0
    assert out["distance_m"] == 100.0
