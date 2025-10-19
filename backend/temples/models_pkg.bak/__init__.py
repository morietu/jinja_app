# backend/temples/models/__init__.py
from .shrine import Shrine

# 他に公開したいモデルがあればここでまとめて再エクスポート
# from .concierge import ConciergeHistory など

__all__ = ["Shrine"]  # 追加したらここも増やす
