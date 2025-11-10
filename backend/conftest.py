import os
from pathlib import Path

def pytest_ignore_collect(path, config):
    # NoGISジョブでは test_gis_* を「モジュールimport前」に無視
    if os.getenv("DISABLE_GIS_FOR_TESTS") == "1":
        name = Path(str(path)).name
        if name.startswith("test_gis_") and name.endswith(".py"):
            return True
    return False
