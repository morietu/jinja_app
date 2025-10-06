# temples/api/throttles.py
from rest_framework.throttling import ScopedRateThrottle


class PlacesNearbyThrottle(ScopedRateThrottle):

    scope = "places-nearby"

    def get_cache_key(self, request, view):
        # 認証ユーザーなら user:pk に束縛、匿名は REMOTE_ADDR を使用（テストでも安定）
        if request.user and request.user.is_authenticated:
            ident = f"user:{request.user.pk}"
        else:
            ident = request.META.get("REMOTE_ADDR") or self.get_ident(request) or "anon"
        return self.cache_format % {"scope": self.scope, "ident": ident}
