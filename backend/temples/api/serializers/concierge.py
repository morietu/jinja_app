# backend/temples/api/serializers/concierge.py
# DEPRECATED: 互換レイヤー。実体は temples.serializers.concierge へ移動済み。
from temples.serializers.concierge import (
    ConciergePlanRequestSerializer,
    ConciergePlanResponseSerializer,
    LocationSerializer,
    PlaceLiteSerializer,
)

__all__ = [
    "LocationSerializer",
    "PlaceLiteSerializer",
    "ConciergePlanRequestSerializer",
    "ConciergePlanResponseSerializer",
]
