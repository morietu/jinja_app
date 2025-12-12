# backend/temples/serializers/routes.py

from typing import List

from rest_framework import serializers
from temples.api.serializers.shrine import ShrineSerializer
from temples.models import Favorite, Goshuin, Shrine, GoshuinImage
from rest_framework import serializers

# ---- Shrine / Favorite（既存APIのI/Oを維持） ----
# ShrineSerializer は既存（temples.api.serializers.shrine）を利用


class ShrineListSerializer(serializers.ModelSerializer):
    location = serializers.SerializerMethodField()

    class Meta:
        model = Shrine
        fields = (
            "id",
            "name_jp",
            "address",
            "latitude",
            "longitude",
            "location",  # ← JSON化安全な形式で返す
            # ...他フィールド
        )

    def get_location(self, obj):
        # 1) 明示的に lon/lat があれば、それを優先
        if obj.longitude is not None and obj.latitude is not None:
            return {"type": "Point", "coordinates": [obj.longitude, obj.latitude]}

        # 2) obj.location が GEOS Point の場合に吸収（NoGIS 環境でも安全）
        loc = getattr(obj, "location", None)
        try:
            from django.contrib.gis.geos import Point as GeoPoint  # 実GISのみ
        except Exception:
            GeoPoint = None

        if GeoPoint is not None and isinstance(loc, GeoPoint):
            try:
                # GEOS Point は x=lon, y=lat
                return {"type": "Point", "coordinates": [loc.x, loc.y]}
            except (AttributeError, TypeError):
                pass

        return None


class FavoriteSerializer(serializers.ModelSerializer):
    shrine = ShrineSerializer(read_only=True)
    shrine_id = serializers.PrimaryKeyRelatedField(
        queryset=Shrine.objects.all(), source="shrine", write_only=True
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


class LocationMixin(serializers.Serializer):
    location = serializers.SerializerMethodField()

    def get_location(self, obj):
        if getattr(obj, "latitude", None) is None or getattr(obj, "longitude", None) is None:
            return None
        return {"lat": float(obj.latitude), "lng": float(obj.longitude)}


class MyGoshuinCreateSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(write_only=True)

    class Meta:
        model = Goshuin
        fields = [
            "id",
            "shrine",
            "title",
            "is_public",
            "image",
        ]
        read_only_fields = ["id"]

    def create(self, validated_data):
        request = self.context["request"]
        user = request.user

        # 画像だけ先に抜き出す
        image_file = validated_data.pop("image", None)

        # Goshuin 本体を作成
        goshuin = Goshuin.objects.create(user=user, **validated_data)

        # 画像があれば GoshuinImage を1枚作る
        if image_file is not None:
            GoshuinImage.objects.create(
                goshuin=goshuin,
                image=image_file,
                order=0,
                size_bytes=getattr(image_file, "size", 0) or 0,
            )

        return goshuin
