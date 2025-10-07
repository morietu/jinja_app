# backend/temples/serializers/__init__.py
from .concierge import (
    ConciergePlanRequestSerializer,
    ConciergePlanResponseSerializer,
    LocationSerializer,
    PlaceLiteSerializer,
    ShrineRecommendationSerializer,
)
from .concierge import ConciergePlanResponseSerializer as ConciergeResponseSerializer  # alias 輸出
from .routes import (
    FavoriteSerializer,
    GoshuinSerializer,
    PopularShrineSerializer,
    RouteLegSerializer,
    RouteRequestSerializer,
    RouteResponseSerializer,
    ShrineSerializer,
)

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
