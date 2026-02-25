from temples.serializers.concierge import ConciergePlanRequestSerializer, PlaceLiteSerializer


def test_plan_request_ok():
    s = ConciergePlanRequestSerializer(
        data={
            "query": "浅草神社",
            "language": "ja",
            "locationbias": "circle:1500@35.715,139.797",
            "transportation": "car",
            "lat": 35.715,
            "lng": 139.797,
        }
    )
    assert s.is_valid(), s.errors
    assert s.validated_data["transportation"] == "car"

def test_place_lite_location_typed():
    s = PlaceLiteSerializer(
        data={
            "place_id": "PID",
            "name": "N",
            "location": {"lat": 35.0, "lng": 139.0},
        }
    )
    assert s.is_valid(), s.errors

def test_plan_request_blank_query_returns_error():
    s = ConciergePlanRequestSerializer(
        data={
            "query": "   ",
            "area": "東京駅",
        }
    )
    assert not s.is_valid()
    assert "query" in s.errors

def test_plan_request_area_aliases_are_resolved_to_area_resolved():
    s = ConciergePlanRequestSerializer(
        data={"query": "縁結び", "where": "東京駅"}
    )
    assert s.is_valid(), s.errors
    assert s.validated_data["area_resolved"] == "東京駅"

    s2 = ConciergePlanRequestSerializer(
        data={"query": "縁結び", "location_text": "渋谷"}
    )
    assert s2.is_valid(), s2.errors
    assert s2.validated_data["area_resolved"] == "渋谷"


def test_plan_request_lon_is_aliased_to_lng():
    s = ConciergePlanRequestSerializer(
        data={"query": "縁結び", "lat": 35.0, "lon": 139.0}
    )
    assert s.is_valid(), s.errors
    assert s.validated_data["lng"] == 139.0


def test_plan_request_radius_km_is_normalized_to_radius_m():
    s = ConciergePlanRequestSerializer(
        data={"query": "縁結び", "lat": 35.0, "lng": 139.0, "radius_km": 5}
    )
    assert s.is_valid(), s.errors
    assert s.validated_data["radius_m"] == 5000


def test_plan_request_radius_m_is_clipped_to_max_50000():
    s = ConciergePlanRequestSerializer(
        data={"query": "縁結び", "lat": 35.0, "lng": 139.0, "radius_m": 999999}
    )
    assert s.is_valid(), s.errors
    assert s.validated_data["radius_m"] == 50000


def test_plan_request_missing_area_and_latlng_returns_location_error():
    s = ConciergePlanRequestSerializer(
        data={"query": "縁結び"}
    )
    assert not s.is_valid()
    assert "location" in s.errors
