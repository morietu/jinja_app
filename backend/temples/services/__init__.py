# temples/services/__init__.py
from . import google_places  # GP モジュールとして使われる箇所向け
from .google_places import details, findplacefromtext, textsearch

__all__ = ["google_places", "textsearch", "details", "findplacefromtext"]
