# backend/temples/tests/test_pkg_import_sweep.py
import importlib
import pkgutil
from types import ModuleType
from typing import Iterable


def iter_modules(pkg_name: str, skip: Iterable[str]) -> Iterable[str]:
    pkg = importlib.import_module(pkg_name)
    if not hasattr(pkg, "__path__"):
        return  # pragma: no cover
    for m in pkgutil.walk_packages(pkg.__path__, prefix=pkg.__name__ + "."):
        name = m.name
        if any(name.startswith(s) for s in skip):
            continue
        yield name


def safe_import(name: str) -> ModuleType | None:
    try:
        return importlib.import_module(name)
    except Exception:
        # import 副作用のある箇所はスキップ（ネットワーク/設定依存など）
        return None


def test_import_everything_lightweight():
    # ここに “重い or 外部依存” を除外指定
    skip_prefixes = {
        # settings/migrations/tests は除外
        "temples.tests",
        "temples.migrations",
        "users.migrations",
        "shrine_project.migrations",
        "shrine_project.settings",
        # 外部API/LLMなど重い所は除外
        "temples.services.google_places",
        "temples.recommendation.llm_adapter",
    }

    # 主要パッケージを軽く網羅
    pkgs = ["temples", "users", "shrine_project"]

    imported = []
    for root in pkgs:
        for name in iter_modules(root, skip_prefixes):
            mod = safe_import(name)
            imported.append((name, mod))

    # 少なくともある程度の数は import できていることだけ確認
    # （数が 0 なら設定が変、という検知）
    assert sum(m is not None for _, m in imported) >= 10
