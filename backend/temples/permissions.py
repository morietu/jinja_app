from __future__ import annotations

from rest_framework.permissions import SAFE_METHODS, BasePermission

# まず API 側があればそれを使う
try:
    from .api.permissions import IsOwnerOrReadOnly as _ApiIsOwner
except Exception:
    _ApiIsOwner = None


class IsOwnerOrReadOnly(BasePermission):
    """
    読み取り(SAFE_METHODS)は許可。
    更新は以下の順で判定:
      1) api.permissions の実装（obj.owner == request.user）
      2) views._is_shrine_owner(user, obj)
      3) 一般的な owner/user/created_by 属性にフォールバック
    """

    def has_object_permission(self, request, view, obj) -> bool:
        if request.method in SAFE_METHODS:
            return True
        user = getattr(request, "user", None)
        if not getattr(user, "is_authenticated", False):
            return False

        if _ApiIsOwner is not None:
            try:
                if _ApiIsOwner().has_object_permission(request, view, obj):
                    return True
            except Exception:
                pass

        try:
            from .views import _is_shrine_owner  # 遅延 import

            if _is_shrine_owner(user, obj):
                return True
        except Exception:
            pass

        for attr in ("owner_id", "user_id", "created_by_id", "owner", "user", "created_by"):
            val = getattr(obj, attr, None)
            if val == getattr(user, "id", None) or getattr(val, "id", None) == getattr(
                user, "id", None
            ):
                return True
        return False
