# backend/temples/serializers/concierge.py
from rest_framework import serializers


class ShrineRecommendationSerializer(serializers.Serializer):
    name = serializers.CharField()
    location = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    note = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class LocationSerializer(serializers.Serializer):
    lat = serializers.FloatField(min_value=-90.0, max_value=90.0)
    lng = serializers.FloatField(min_value=-180.0, max_value=180.0)


class PlaceLiteSerializer(serializers.Serializer):
    place_id = serializers.CharField()
    name = serializers.CharField()
    address = serializers.CharField(allow_null=True, required=False)
    location = LocationSerializer()
    rating = serializers.FloatField(required=False, allow_null=True)
    user_ratings_total = serializers.IntegerField(required=False, allow_null=True)
    open_now = serializers.BooleanField(required=False, allow_null=True)
    photo_reference = serializers.CharField(required=False, allow_null=True)
    icon = serializers.CharField(required=False, allow_null=True)


class ConciergePlanRequestSerializer(serializers.Serializer):
    query = serializers.CharField()
    language = serializers.CharField(required=False, default="ja")
    locationbias = serializers.CharField(required=False, allow_blank=True)
    transportation = serializers.ChoiceField(
        choices=["walk", "car"], required=False, default="walk"
    )


class ConciergePlanResponseSerializer(serializers.Serializer):
    # ← APIが直接返すトップレベルの形
    query = serializers.CharField()
    transportation = serializers.ChoiceField(
        choices=["walk", "car"], required=False, default="walk"
    )
    main = PlaceLiteSerializer(allow_null=True, required=False, default=None)
    alternatives = PlaceLiteSerializer(many=True, required=False, default=list)
    route_hints = serializers.DictField(required=False, default=dict)


# 互換 alias（ConciergeResponseSerializer を参照している箇所があるので維持）
ConciergeResponseSerializer = ConciergePlanResponseSerializer

__all__ = [
    "ShrineRecommendationSerializer",
    "LocationSerializer",
    "PlaceLiteSerializer",
    "ConciergePlanRequestSerializer",
    "ConciergePlanResponseSerializer",
    "ConciergeResponseSerializer",
]
