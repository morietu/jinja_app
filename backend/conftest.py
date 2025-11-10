# backend/conftest.py
import os
from pathlib import Path

GIS_HINTS = ("django.contrib.gis", "GEOS", "gdal")

def _looks_like_gis_test(p: Path) -> bool:
    if p.suffix != ".py":
        return False
    try:
        # 先頭数KBだけ読む（高速）
        head = p.read_text(encoding="utf-8", errors="ignore")[:4000]
    except Exception:
        return False
    return any(h in head for h in GIS_HINTS)

# 🔧 PytestRemovedIn9Warning 対応：collection_path: Path を使う
def pytest_ignore_collect(collection_path: Path, config):
    """
    NoGISジョブ（DISABLE_GIS_FOR_TESTS=1）のときは、
    - ファイル名が test_gis_* のテスト
    - もしくは内容に GIS import の痕跡があるテスト
    をモジュール import 前に収集対象から外す。
    """
    if os.getenv("DISABLE_GIS_FOR_TESTS") == "1":
        name = collection_path.name
        if name.startswith("test_gis_") or _looks_like_gis_test(collection_path):
            return True
    return False
