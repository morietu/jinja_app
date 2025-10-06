# 変更前
# from rest_framework.throttling import ScopedRateThrottle
# class PlacesNearbyThrottle(ScopedRateThrottle):

from rest_framework.throttling import SimpleRateThrottle


class PlacesNearbyThrottle(SimpleRateThrottle):
    scope = "places-nearby"

    def get_cache_key(self, request, view):
        # 認証ユーザーは user:<pk>、匿名は REMOTE_ADDR → 無ければ固定 'anon'
        if getattr(request, "user", None) and getattr(request.user, "is_authenticated", False):
            ident = f"user:{request.user.pk}"
        else:
            ident = request.META.get("REMOTE_ADDR") or "anon"
        return self.cache_format % {"scope": self.scope, "ident": ident}
