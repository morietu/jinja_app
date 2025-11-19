# backend/temples/api/serializers/concierge.py
# COMPAT LAYER:
# 互換レイヤー。できる限り temples.serializers.concierge から再エクスポートし、
# 見つからないシンボルのみ最小実装でフォールバックします。
from __future__ import annotations
from rest_framework import serializers
from temples.models import ConciergeThread, ConciergeMessage



# まず新モジュールからインポート（存在すればそれを使う）
try:
    from temples.serializers.concierge import (
        ConciergeHistorySerializer as _NewConciergeHistorySerializer,  # あるなら使う
    )
    from temples.serializers.concierge import (  # type: ignore
        ConciergePlanRequestSerializer,
        ConciergePlanResponseSerializer,
        LocationSerializer,
        PlaceLiteSerializer,
    )
    from temples.serializers.concierge import (
        ConciergeRecommendationsQuery as _NewConciergeRecommendationsQuery,  # あるなら使う
    )
    from temples.serializers.concierge import (
        ConciergeRecommendationsResponse as _NewConciergeRecommendationsResponse,  # あるなら使う
    )
    from temples.serializers.concierge import (
        ShrineNearbySerializer as _NewShrineNearbySerializer,  # あるなら使う
    )
except Exception:  # 新モジュールがない環境でも壊れないように
    from temples.serializers.concierge import (  # type: ignore
        ConciergePlanRequestSerializer,
        ConciergePlanResponseSerializer,
        LocationSerializer,
        PlaceLiteSerializer,
    )

    _NewConciergeHistorySerializer = None
    _NewConciergeRecommendationsQuery = None
    _NewConciergeRecommendationsResponse = None
    _NewShrineNearbySerializer = None

# --- フォールバック定義（新モジュールに無い場合のみ） ---

try:
    from temples.models import ConciergeHistory, Shrine
except Exception:  # モデルの import で落ちないように（migrate 前など）
    ConciergeHistory = None  # type: ignore
    Shrine = None  # type: ignore


# History 一覧用
class _FallbackConciergeHistorySerializer(serializers.ModelSerializer):
    shrine_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = ConciergeHistory  # type: ignore
        fields = [
            "id",
            "user",
            "shrine",
            "shrine_name",
            "reason",
            "tags",
            "created_at",
        ]
        read_only_fields = ["id", "user", "created_at", "shrine_name"]

    def get_shrine_name(self, obj):
        s = getattr(obj, "shrine", None)
        if s is not None and Shrine is not None:
            # name_jp 優先、無ければ name
            return getattr(s, "name_jp", None) or getattr(s, "name", None)
        return None


# レコメンド入力クエリ
class _FallbackConciergeRecommendationsQuery(serializers.Serializer):
    q = serializers.CharField(required=False, allow_blank=True)
    theme = serializers.CharField(required=False, allow_blank=True)
    limit = serializers.IntegerField(required=False, min_value=1, max_value=10, default=3)
    lat = serializers.FloatField(required=False)
    lng = serializers.FloatField(required=False)


# Shrine の軽量表現（Nearby 用）
class _FallbackShrineNearbySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name_jp = serializers.CharField(allow_null=True, required=False)
    address = serializers.CharField(allow_null=True, required=False)
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    distance_m = serializers.FloatField(required=False)
    goriyaku_tags = serializers.ListField(
        child=serializers.DictField(child=serializers.CharField()),
        required=False,
    )


# レコメンド結果全体
class _FallbackConciergeRecommendationsResponse(serializers.Serializer):
    results = serializers.ListField(child=_FallbackShrineNearbySerializer())

    # optional origin: {lat, lng, label?}
    origin = serializers.DictField(required=False)

class ConciergeThreadSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConciergeThread
        fields = [
            "id",
            "title",
            "last_message",
            "last_message_at",
            "message_count",
        ]


class ConciergeMessageSerializer(serializers.ModelSerializer):
    thread_id = serializers.IntegerField(source="thread_id", read_only=True)
    content = serializers.CharField(source="text")
    
    class Meta:
        model = ConciergeMessage
        fields = [
            "id",
            "role",
            "content",
            "created_at",
        ]


class ConciergeThreadDetailSerializer(serializers.ModelSerializer):
    messages = ConciergeMessageSerializer(many=True, read_only=True)

    class Meta:
        model = ConciergeThread
        fields = [
            "id",
            "title",
            "last_message",
            "last_message_at",
            "message_count",
            "messages",
        ]

class ConciergeRecommendationSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False, allow_null=True)
    place_id = serializers.CharField(required=False, allow_null=True)
    name = serializers.CharField()
    address = serializers.CharField(required=False, allow_null=True)
    lat = serializers.FloatField(required=False, allow_null=True)
    lng = serializers.FloatField(required=False, allow_null=True)
    distance_m = serializers.IntegerField()
    duration_min = serializers.IntegerField()
    reason = serializers.CharField()
    photo_url = serializers.CharField(required=False, allow_null=True)


class ConciergeChatRequestSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=4000)
    thread_id = serializers.IntegerField(required=False, allow_null=True)


# --- 公開シンボルの最終決定 ---
ConciergeHistorySerializer = _NewConciergeHistorySerializer or _FallbackConciergeHistorySerializer

ConciergeRecommendationsQuery = (
    _NewConciergeRecommendationsQuery or _FallbackConciergeRecommendationsQuery
)

ConciergeRecommendationsResponse = (
    _NewConciergeRecommendationsResponse or _FallbackConciergeRecommendationsResponse
)

ShrineNearbySerializer = _NewShrineNearbySerializer or _FallbackShrineNearbySerializer

# 互換レイヤとして「公式にエクスポートする」のは従来どおりこの4つだけ
__all__ = [
    "LocationSerializer",
    "PlaceLiteSerializer",
    "ConciergePlanRequestSerializer",
    "ConciergePlanResponseSerializer",
    "ConciergeHistorySerializer",
    "ConciergeRecommendationsQuery",
    "ConciergeRecommendationsResponse",
    "ShrineNearbySerializer",
    "ConciergeThreadSerializer",
    "ConciergeMessageSerializer",
    "ConciergeThreadDetailSerializer",
]

# ※ それ以外のシンボル（ConciergeHistorySerializer など）は
#    直接 import では使えるが、__all__ には載せない（互換APIの契約を崩さないため）。
