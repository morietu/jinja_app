# backend/temples/serializers/__init__.py
from .concierge import (
    ConciergePlanRequestSerializer,
    ConciergePlanResponseSerializer,
    LocationSerializer,
    PlaceLiteSerializer,
    ShrineRecommendationSerializer,
)
from .concierge import ConciergePlanResponseSerializer as ConciergeResponseSerializer  # alias 輸出

try:
    from .routes import (
        DeitySerializer,
        GoriyakuTagSerializer,
        ShrineSerializer,
    )
except Exception:
    ShrineSerializer = None  # type: ignore
    GoriyakuTagSerializer = None  # type: ignore
    DeitySerializer = None  # type: ignore


__all__ = [
    "ShrineRecommendationSerializer",
    "LocationSerializer",
    "PlaceLiteSerializer",
    "ConciergePlanRequestSerializer",
    "ConciergePlanResponseSerializer",
    "ConciergeResponseSerializer",
    "FavoriteSerializer",
    "GoshuinSerializer",
    "PopularShrineSerializer",
    "RouteLegSerializer",
    "RouteRequestSerializer",
    "RouteResponseSerializer",
    "ShrineSerializer",
]
