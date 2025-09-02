#!/usr/bin/env python
import os
import sys
import platform
from pathlib import Path

def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "shrine_project.settings")

    # ── ここがポイント ─────────────────────────────────────────────
    # Windows のときだけ gdal.dll を見る。Linux(Docker)では何もしない。
    if platform.system() == "Windows":
        # Miniforge/conda を想定。無ければスキップされます。
        dll_dir = Path(os.environ.get("CONDA_PREFIX", "")) / "Library" / "bin"
        gdal_dll = dll_dir / "gdal.dll"
        if gdal_dll.exists():
            os.environ.setdefault("GDAL_LIBRARY_PATH", str(gdal_dll))
    # ────────────────────────────────────────────────────────────────

    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Activate the correct environment?"
        ) from exc
    execute_from_command_line(sys.argv)

if __name__ == "__main__":
    main()
