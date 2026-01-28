from __future__ import annotations

from typing import Any
import importlib

__all__ = [
    "google_places",
    "textsearch",
    "details",
    "findplacefromtext",
    "append_chat",
    "ChatSaveResult",
]

def __getattr__(name: str) -> Any:
    if name == "google_places":
        gp = importlib.import_module(__name__ + ".google_places")  # ← ここが肝
        globals()["google_places"] = gp  # キャッシュ
        return gp

    if name in {"details", "findplacefromtext", "textsearch"}:
        gp = importlib.import_module(__name__ + ".google_places")
        obj = getattr(gp, name)
        globals()[name] = obj
        return obj

    if name in {"append_chat", "ChatSaveResult"}:
        mod = importlib.import_module(__name__ + ".concierge_history")
        obj = getattr(mod, name)
        globals()[name] = obj
        return obj

    raise AttributeError(name)
