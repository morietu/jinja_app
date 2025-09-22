from rest_framework import serializers

__all__ = [
    "PlaceLiteSerializer",
    "ConciergePlanRequestSerializer",
    "RecommendationSerializer",
    "ConciergeResponseSerializer",
]

class PointSerializer(serializers.Serializer):
    lat = serializers.FloatField()
    lng = serializers.FloatField()


class PlaceLiteSerializer(serializers.Serializer):
    place_id = serializers.CharField(required=False, allow_blank=True)
    name = serializers.CharField(max_length=200)
    location = PointSerializer(required=False, allow_null=True)  # ★ dict を許可
    formatted_address = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    reason = serializers.CharField(required=False, allow_blank=True, allow_null=True)

class ConciergePlanRequestSerializer(serializers.Serializer):
    query = serializers.CharField()
    candidates = PlaceLiteSerializer(many=True, required=False, default=list)
    language = serializers.CharField(required=False, default="ja")
    locationbias = serializers.CharField(required=False, allow_blank=True)
    transportation = serializers.ChoiceField(required=False, choices=["walk", "car", "transit"], default="walk")
    lat = serializers.FloatField(required=False)
    lng = serializers.FloatField(required=False)
    radius_m = serializers.IntegerField(required=False, min_value=1000, max_value=50000)
    radius_km = serializers.IntegerField(required=False, min_value=1, max_value=50)
    area = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    where = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    location_text = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    
class RecommendationSerializer(serializers.Serializer):
    name = serializers.CharField()
    location = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    reason = serializers.CharField(required=False, allow_blank=True, allow_null=True)

class ConciergeResponseSerializer(serializers.Serializer):
    recommendations = RecommendationSerializer(many=True)
