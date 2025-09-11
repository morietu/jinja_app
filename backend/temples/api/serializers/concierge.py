from rest_framework import serializers
from temples.models import ConciergeHistory


# ---- Mini / Common ----
class GoriyakuTagMiniSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()


class LocationSerializer(serializers.Serializer):
    lat = serializers.FloatField(min_value=-90.0, max_value=90.0)
    lng = serializers.FloatField(min_value=-180.0, max_value=180.0)


# ---- Nearby / Origin ----
class ShrineNearbySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name_jp = serializers.CharField()
    address = serializers.CharField()
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    distance_m = serializers.FloatField(required=False)
    goriyaku_tags = GoriyakuTagMiniSerializer(many=True, required=False)


class OriginSerializer(serializers.Serializer):
    lat = serializers.FloatField(min_value=-90.0, max_value=90.0)
    lng = serializers.FloatField(min_value=-180.0, max_value=180.0)
    label = serializers.CharField(required=False, allow_blank=True)


# ---- GET: /api/concierge/recommendations ----
class ConciergeRecommendationsQuery(serializers.Serializer):
    lat = serializers.FloatField(required=False, min_value=-90.0, max_value=90.0)
    lng = serializers.FloatField(required=False, min_value=-180.0, max_value=180.0)
    q = serializers.CharField(required=False, allow_blank=True)
    theme = serializers.CharField(required=False, allow_blank=True)
    limit = serializers.IntegerField(required=False, min_value=1, max_value=10, default=3)


class ConciergeRecommendationsResponse(serializers.Serializer):
    origin = OriginSerializer(required=False)
    results = ShrineNearbySerializer(many=True)
    message = serializers.CharField(required=False, allow_blank=True)


# ---- History ----
class ConciergeHistorySerializer(serializers.ModelSerializer):
    shrine_name = serializers.CharField(source="shrine.name_jp", read_only=True)

    class Meta:
        model = ConciergeHistory
        fields = ["id", "shrine", "shrine_name", "reason", "tags", "created_at"]


# ---- Concierge Plan (POST) ----
class ConciergePlanRequestSerializer(serializers.Serializer):
    query = serializers.CharField()
    language = serializers.CharField(required=False, default="ja")
    locationbias = serializers.CharField(required=False, allow_blank=True)
    # UI は "walk" / "car"。route_hints では内部で "walk"/"drive" に変換します。
    transportation = serializers.ChoiceField(choices=["walk", "car"], default="walk")


class PlaceLiteSerializer(serializers.Serializer):
    place_id = serializers.CharField()
    name = serializers.CharField()
    address = serializers.CharField(allow_null=True, required=False)
    location = LocationSerializer()  # DictField -> 型付きに変更
    rating = serializers.FloatField(required=False, allow_null=True)
    user_ratings_total = serializers.IntegerField(required=False, allow_null=True)
    open_now = serializers.BooleanField(required=False, allow_null=True)
    photo_reference = serializers.CharField(required=False, allow_null=True)
    icon = serializers.CharField(required=False, allow_null=True)


class ConciergePlanResponseSerializer(serializers.Serializer):
    query = serializers.CharField()
    transportation = serializers.ChoiceField(choices=["walk", "car"])
    main = PlaceLiteSerializer(allow_null=True)
    alternatives = PlaceLiteSerializer(many=True)
    # route_hints は柔軟性のため Dict のまま（mode/waypoints を想定）
    route_hints = serializers.DictField()
