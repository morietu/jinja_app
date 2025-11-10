import os
from pathlib import Path

GIS_HINTS = ("django.contrib.gis", "GEOS", "gdal")

def _looks_like_gis_test(p: Path) -> bool:
    if p.suffix != ".py":
        return False
    try:
        head = p.read_text(encoding="utf-8", errors="ignore")[:4000]
    except Exception:
        return False
    return any(h in head for h in GIS_HINTS)

def pytest_ignore_collect(collection_path: Path, config):
    if os.getenv("DISABLE_GIS_FOR_TESTS") == "1":
        name = collection_path.name
        if name.startswith("test_gis_") and name.endswith(".py"):
            return True
        if _looks_like_gis_test(collection_path):
            return True
    return False
