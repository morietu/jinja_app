# backend/temples/serializers/routes.py
from typing import List

from django.apps import apps
from rest_framework import serializers

Shrine = apps.get_model("temples", "Shrine", require_ready=False)  # type: ignore
Goshuin = apps.get_model("temples", "Goshuin", require_ready=False)  # type: ignore
Favorite = apps.get_model("temples", "Favorite", require_ready=False)  # type: ignore


# ---- Shrine / Favorite（既存APIのI/Oを維持） ----
class ShrineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shrine
        fields = ["id", "name_jp", "name_romaji", "address", "latitude", "longitude"]


class FavoriteSerializer(serializers.ModelSerializer):
    shrine = ShrineSerializer(read_only=True)
    shrine_id = serializers.PrimaryKeyRelatedField(
        queryset=Shrine.objects.all(),
        source="shrine",
        write_only=True,
    )

    class Meta:
        model = Favorite
        fields = ["id", "shrine", "shrine_id", "created_at"]
        read_only_fields = ["id", "created_at"]


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


class PopularShrineSerializer(serializers.ModelSerializer):
    latitude = serializers.SerializerMethodField()
    longitude = serializers.SerializerMethodField()

    class Meta:
        model = Shrine
        fields = [
            "id",
            "name_jp",
            "address",
            "latitude",
            "longitude",
            "views_30d",
            "favorites_30d",
            "popular_score",
        ]

    def get_latitude(self, obj):
        if getattr(obj, "location", None):
            return obj.location.y  # GeoDjango: y=lat
        return getattr(obj, "latitude", None)

    def get_longitude(self, obj):
        if getattr(obj, "location", None):
            return obj.location.x  # GeoDjango: x=lng
        return getattr(obj, "longitude", None)


class GoshuinSerializer(serializers.ModelSerializer):
    shrine_name = serializers.CharField(source="shrine.name_jp", read_only=True)
    image_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Goshuin
        fields = [
            "id",
            "shrine",
            "shrine_name",
            "title",
            "is_public",
            "likes",
            "created_at",
            "image_url",
        ]

    def get_image_url(self, obj):
        img = obj.images.order_by("order", "id").first()
        if not img or not img.image:
            return None
        request = self.context.get("request")
        url = img.image.url
        return request.build_absolute_uri(url) if request else url
