# RouteRequest/Response の簡易Serializer（修正版）
from typing import List
from rest_framework import serializers
from .models import Shrine, Favorite, Goshuin  # ← temples.models の重複importは不要

# ---- Shrine / Favorite（既存APIのI/Oを維持） ----
class ShrineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shrine
        fields = ["id", "name_jp", "name_romaji", "address", "latitude", "longitude"]


class FavoriteSerializer(serializers.ModelSerializer):
    # レスポンスで shrine の中身を返す
    shrine = ShrineSerializer(read_only=True)
    # リクエストでは shrine_id を受けて shrine にマップ
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
    """
    geometry: [[lat, lng], ...] を検証
    - 各要素は [lat, lng] の2要素
    - 要素は float（範囲チェックは簡易）
    """
    child = serializers.ListField(
        child=serializers.FloatField(),
        min_length=2,
        max_length=2,
    )


class RouteRequestSerializer(serializers.Serializer):
    """
    例:
    {
      "mode": "walking",
      "origin": {"lat": 35.68, "lng": 139.76},
      "destinations": [{"lat": 35.67, "lng": 139.71}, ...]
    }
    """
    mode = serializers.ChoiceField(choices=["walking", "driving"], default="walking")
    origin = PointSerializer()
    destinations = PointSerializer(many=True, allow_empty=False)

    # 追加の軽量バリデーション
    def validate_destinations(self, value: List[dict]) -> List[dict]:
        # 過剰な座標リストを防止（UI想定は最大3件：メイン+近隣2）
        if len(value) > 5:
            raise serializers.ValidationError("destinations は最大 5 件までにしてください。")
        return value


class RouteLegSerializer(serializers.Serializer):
    from_ = PointSerializer(source="from")
    to = PointSerializer()
    distance_m = serializers.IntegerField(min_value=0)
    duration_s = serializers.IntegerField(min_value=0)
    geometry = GeometryListField()  # ← ListSerializer ではなく ListField でOK


class RouteResponseSerializer(serializers.Serializer):
    # 検証とドキュメント用（Strict すぎない程度）
    mode = serializers.ChoiceField(choices=["walking", "driving"])
    legs = RouteLegSerializer(many=True)
    distance_m_total = serializers.IntegerField(min_value=0)
    duration_s_total = serializers.IntegerField(min_value=0)
    provider = serializers.CharField()


class PopularShrineSerializer(serializers.ModelSerializer):
    latitude = serializers.SerializerMethodField()
    longitude = serializers.SerializerMethodField()

    class Meta:
        model = Shrine
        fields = [
            "id", "name_jp", "address",
            "latitude", "longitude",
            "views_30d", "favorites_30d", "popular_score",
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
    # ← ここで親FKの name_jp を露出
    shrine_name = serializers.CharField(source="shrine.name_jp", read_only=True)
    # 便利フィールド（既にあるなら流用）
    image_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Goshuin
        fields = [
            "id",
            "shrine",        # FK ID（従来通りPOST/PUTで受ける）
            "shrine_name",   # ★ 追加（読み取り専用）
            "title",
            "is_public",
            "likes",
            "created_at",
            "image_url",     # あるとフロントが楽
        ]

    def get_image_url(self, obj):
        img = obj.images.order_by("order", "id").first()
        if not img or not img.image:
            return None
        request = self.context.get("request")
        url = img.image.url
        return request.build_absolute_uri(url) if request else url
