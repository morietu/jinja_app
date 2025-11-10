import logging
import os
from pathlib import Path

import pytest


@pytest.fixture(autouse=True, scope="session")
def _quiet_logs():
    for name in ("urllib3", "django.request"):
        logging.getLogger(name).setLevel(logging.WARN)


# ★ 関数スコープにする（= decorator だけ。scope 指定しない）
@pytest.fixture(autouse=True)
def _fast_password_hashers(settings):
    """テスト時のみパスワードハッシュをMD5に切り替えて高速化"""
    settings.PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
    settings.AUTH_PASSWORD_VALIDATORS = []


GIS_HINTS = (
    "from django.contrib.gis",
    "import GEOS",
    "from django.contrib.gis.gdal",
    "from django.contrib.gis.geos",
)


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
