# backend/temples/tests/test_gis_smoke.py
import os
import pytest
from django.contrib.gis import gdal

# USE_GIS=1 のときだけ実行。その他はモジュールごとskip。
if os.getenv("USE_GIS") != "1":
    pytest.skip("GIS disabled by env", allow_module_level=True)


@pytest.mark.skipif(not getattr(gdal, "HAS_GDAL", False), reason="GDAL not available locally")
def test_gis_runtime_available():
    from django.contrib.gis import geos, gdal

    pt = geos.Point(139.6917, 35.6895, srid=4326)
    assert pt.srid == 4326
    assert bool(getattr(gdal, "HAS_GDAL", False)) is True
