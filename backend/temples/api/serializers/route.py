# backend/temples/api/serializers/route.py
from __future__ import annotations

from typing import List
from rest_framework import serializers

# ---- Route API 用 ----
class PointSerializer(serializers.Serializer):
    lat = serializers.FloatField(min_value=-90.0, max_value=90.0)
    lng = serializers.FloatField(min_value=-180.0, max_value=180.0)

class GeometryListField(serializers.ListField):
    child = serializers.ListField(
        child=serializers.FloatField(),
        min_length=2,
        max_length=2,
    )

class RouteRequestSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=["walking", "driving"], default="walking")
    origin = PointSerializer()
    destinations = PointSerializer(many=True, allow_empty=False)

    def validate_destinations(self, value: List[dict]) -> List[dict]:
        if len(value) > 5:
            raise serializers.ValidationError("destinations は最大 5 件までにしてください。")
        return value

class RouteLegSerializer(serializers.Serializer):
    from_ = PointSerializer(source="from")
    to = PointSerializer()
    distance_m = serializers.IntegerField(min_value=0)
    duration_s = serializers.IntegerField(min_value=0)
    geometry = GeometryListField()

class RouteResponseSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=["walking", "driving"])
    legs = RouteLegSerializer(many=True)
    distance_m_total = serializers.IntegerField(min_value=0)
    duration_s_total = serializers.IntegerField(min_value=0)
    provider = serializers.CharField()
    cached = serializers.BooleanField()

class SimpleRouteResponseSerializer(serializers.Serializer):
    distance_m = serializers.FloatField(min_value=0)
    duration_s = serializers.FloatField(min_value=0)
    geometry = serializers.JSONField()  # GeoJSON
