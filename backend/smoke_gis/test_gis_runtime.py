# backend/smoke_gis/test_gis_runtime.py
import importlib

def test_geodjango_runtime_available():
    # GeoDjangoの最小モジュールがimportできること
    assert importlib.import_module("django.contrib.gis") is not None
    assert importlib.import_module("django.contrib.gis.geos") is not None
    assert importlib.import_module("django.contrib.gis.gdal") is not None

    # GEOSの基本クラスが生成できること
    Point = importlib.import_module("django.contrib.gis.geos").Point
    p = Point(139.6917, 35.6895)  # (lon, lat) 東京あたり
    assert p.x and p.y
