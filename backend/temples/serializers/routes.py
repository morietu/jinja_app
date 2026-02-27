# backend/temples/serializers/routes.py
"""
互換用 re-export モジュール。
既存 import パス（temples.serializers.routes）を壊さないための窓口。
"""

# goshuin
from temples.api.serializers.goshuin import GoshuinSerializer  # noqa: F401
from temples.api.serializers.my_goshuin import MyGoshuinCreateSerializer

# route
from temples.api.serializers.route import (
    RouteRequestSerializer,
    RouteResponseSerializer,
    SimpleRouteResponseSerializer,
)
