import hashlib

from rest_framework.throttling import SimpleRateThrottle


class LoginThrottle(SimpleRateThrottle):
    """Count login attempts, without changing credentials or storing usernames."""

    scope = "auth_login"

    def get_cache_key(self, request, view):
        username = str(request.data.get("username", "")).strip().lower()
        identity = hashlib.sha256(username.encode("utf-8")).hexdigest()
        return self.cache_format % {"scope": self.scope, "ident": identity}
