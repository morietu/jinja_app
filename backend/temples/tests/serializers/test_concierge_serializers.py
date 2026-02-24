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
