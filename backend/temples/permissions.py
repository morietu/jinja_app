# backend/temples/permissions.py
from __future__ import annotations

from typing import Any, Callable, Optional, Type

from rest_framework.permissions import SAFE_METHODS, BasePermission

# temples.api.permissions があればそれを優先して委譲する
try:
    from temples.api.permissions import IsOwnerOrReadOnly as _ImportedIsOwner

    _UpstreamIsOwner: Optional[Type[BasePermission]] = _ImportedIsOwner
except Exception:
    _UpstreamIsOwner = None


class IsOwnerOrReadOnly(BasePermission):
    """
    読み取り(SAFE_METHODS)は許可。
    更新は以下の順で判定:
      1) temples.api.permissions の実装（あれば）
      2) views._is_shrine_owner(user, obj)（あれば）
      3) owner/user/created_by など汎用属性にフォールバック
    """

    def has_object_permission(self, request, view, obj) -> bool:
        if request.method in SAFE_METHODS:
            return True

        user = getattr(request, "user", None)
        if not getattr(user, "is_authenticated", False):
            return False

        # 1) 上位実装に委譲
        if _UpstreamIsOwner is not None:
            try:
                return _UpstreamIsOwner().has_object_permission(request, view, obj)
            except Exception:
                # 例外時はフォールバックへ
                pass

        # 2) アプリ内ヘルパに委譲（遅延 import で循環回避）
        _is_shrine_owner: Optional[Callable[[Any, Any], bool]] = None
        try:
            from .views import _is_shrine_owner as _impl

            _is_shrine_owner = _impl
        except Exception:
            pass

        if _is_shrine_owner is not None:
            try:
                if _is_shrine_owner(user, obj):
                    return True
            except Exception:
                pass

        # 3) 一般的な属性のフォールバック
        for attr in ("owner_id", "user_id", "created_by_id", "owner", "user", "created_by"):
            val = getattr(obj, attr, None)
            if val == getattr(user, "id", None) or getattr(val, "id", None) == getattr(
                user, "id", None
            ):
                return True

        return False


__all__ = ["IsOwnerOrReadOnly"]
