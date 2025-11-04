# backend/temples/api/views/throttles.py
from rest_framework.throttling import ScopedRateThrottle


class ConciergeThrottle(ScopedRateThrottle):
    scope = "concierge"
