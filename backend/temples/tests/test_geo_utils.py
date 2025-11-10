# backend/temples/tests/test_geo_utils.py
from temples.geo_utils import to_lon_lat, to_lat_lng_dict


def test_geo_utils_variants():
    # GeoJSON Point
    j = {"type": "Point", "coordinates": [139.7, 35.6]}
    assert to_lon_lat(j) == (139.7, 35.6)
    assert to_lat_lng_dict(j) == {"lat": 35.6, "lng": 139.7}

    # tuple
    t = (139.7, 35.6)
    assert to_lon_lat(t) == (139.7, 35.6)
    assert to_lat_lng_dict(t) == {"lat": 35.6, "lng": 139.7}

    # list
    L = [139.7, 35.6]
    assert to_lon_lat(L) == (139.7, 35.6)
