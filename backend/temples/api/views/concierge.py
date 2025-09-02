# backend/temples/api/views/concierge.py
from __future__ import annotations

import os
import re
import json
from openai import OpenAI

from django.db.models import Prefetch
from django.contrib.gis.geos import Point
from django.contrib.gis.db.models.functions import Distance

from rest_framework import status, generics, permissions, serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from temples.models import Shrine, ConciergeHistory, GoriyakuTag
from temples.api.serializers.concierge import (
    ShrineNearbySerializer,
    ConciergeRecommendationsQuery,
    ConciergeRecommendationsResponse,
    ConciergeHistorySerializer,
)
from temples.geocoding.client import GeocodingClient, GeocodingError


class ConciergeRecommendationsView(APIView):
    """
    GET /api/concierge/recommendations
      - lat/lng 指定: 近い順
      - q 指定: サーバ側で geocode → 起点決定
      - theme: ご利益タグ名の部分一致フィルタ
      - limit: 件数(既定3, 最大10)
    レスポンスは ConciergeRecommendationsResponse 形式
    """
    authentication_classes: list = []
    permission_classes: list = []

    def get(self, request, *args, **kwargs):
        # クエリ検証
        qser = ConciergeRecommendationsQuery(data=request.query_params)
        qser.is_valid(raise_exception=True)
        params = qser.validated_data

        q = params.get("q") or ""
        theme = params.get("theme") or ""
        limit = params.get("limit") or 3
        lat = params.get("lat")
        lng = params.get("lng")

        origin_point = None
        origin_label = None

        # 起点を決める（lat/lng 優先 → q を geocode）
        try:
            if lat is not None and lng is not None:
                origin_point = Point(float(lng), float(lat), srid=4326)
                origin_label = "origin"
            elif q:
                try:
                    gc = GeocodingClient()
                    cands = gc.geocode_candidates(q, limit=1)
                    if cands:
                        r0 = cands[0]
                        origin_point = Point(float(r0.lon), float(r0.lat), srid=4326)
                        origin_label = r0.formatted or q
                except GeocodingError:
                    origin_point = None
        except Exception:
            origin_point = None

        # ベースQuery（座標未設定は除外）
        qs = (
            Shrine.objects
            .exclude(latitude__isnull=True)
            .exclude(longitude__isnull=True)
            .exclude(location__isnull=True)
            .prefetch_related(
                Prefetch("goriyaku_tags", queryset=GoriyakuTag.objects.only("id", "name"))
            )
        )

        if theme:
            qs = qs.filter(goriyaku_tags__name__icontains=theme).distinct()

        if origin_point:
            # SRID=4326 の Distance は近似値（必要なら ST_DistanceSphere に差し替え可）
            qs = qs.annotate(distance=Distance("location", origin_point)).order_by("distance")
        else:
            qs = qs.order_by("id")

        rows = []
        for s in qs[:limit]:
            item = {
                "id": s.id,
                "name_jp": s.name_jp,
                "address": s.address,
                "latitude": float(s.latitude),
                "longitude": float(s.longitude),
            }
            if origin_point and hasattr(s, "distance") and s.distance is not None:
                # GeoDjango の Distance は .m でメートル（バックエンドの実装環境によっては単位なしの場合あり）
                item["distance_m"] = float(s.distance.m) if hasattr(s.distance, "m") else float(s.distance)
            item["goriyaku_tags"] = [{"id": t.id, "name": t.name} for t in s.goriyaku_tags.all()]
            rows.append(item)

        data = {
            "results": ShrineNearbySerializer(rows, many=True).data
        }
        if origin_point is not None:
            data["origin"] = {"lat": origin_point.y, "lng": origin_point.x}
            if origin_label:
                data["origin"]["label"] = origin_label

        # レスポンス型で最終整形
        return Response(ConciergeRecommendationsResponse(data).data, status=status.HTTP_200_OK)


# 診断(生年月日等)の POST API は、整理版では別エンドポイントにしておく。
# 入力用シリアライザをローカル定義（views 内）で最小維持。
class ConciergePreferenceSerializer(serializers.Serializer):
    birth_year = serializers.IntegerField(required=True)
    birth_month = serializers.IntegerField(required=False, min_value=1, max_value=12)
    birth_day = serializers.IntegerField(required=False, min_value=1, max_value=31)
    theme = serializers.CharField(required=False, allow_blank=True)


client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


class ConciergeHistoryListView(generics.ListAPIView):
    serializer_class = ConciergeHistorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ConciergeHistory.objects.filter(user=self.request.user).order_by("-created_at")


class ConciergeAPIView(APIView):
    """
    POST /api/concierge  （AI診断：任意・フロントの安定化後に育てる想定）
      body: { birth_year, birth_month?, birth_day?, theme? }
      return: { recommendation, reason, tags[], shrine_id? }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        ser = ConciergePreferenceSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        birth_year = ser.validated_data["birth_year"]
        birth_month = ser.validated_data.get("birth_month")
        birth_day = ser.validated_data.get("birth_day")
        theme = ser.validated_data.get("theme", "総合運")

        zodiac_animals = ["申", "酉", "戌", "亥", "子", "丑", "寅", "卯", "辰", "巳", "午", "未"]
        zodiac = zodiac_animals[birth_year % 12]

        prompt = f"""
        あなたは日本の神社コンシェルジュです。
        ユーザーの生年月日は {birth_year}年{birth_month or ''}月{birth_day or ''}日 です。
        干支は {zodiac} です。
        相談テーマは「{theme}」です。

        以下を考慮して、ユーザーに最適な神社を1つ提案してください：
        - 干支や年齢に基づいた縁起
        - テーマ（恋愛・仕事・健康など）に関連するご利益
        - 日本で実際に参拝できる有名な神社

        出力は必ず次のJSON形式で返してください：
        {{
          "recommendation": "神社名",
          "reason": "提案理由（2〜3文）",
          "tags": ["縁結び", "仕事運"]
        }}
        """

        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a helpful Shinto shrine concierge."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.7,
            )

            content = (response.choices[0].message.content or "").strip()

            # 念のため JSON 抽出（非JSON混入対策）
            match = re.search(r"\{.*\}", content, re.DOTALL)
            if match:
                try:
                    result = json.loads(match.group(0))
                except Exception:
                    result = None
            else:
                result = None

            if not result:
                safe_content = content.encode("utf-8", "ignore").decode("utf-8")
                result = {"recommendation": "不明", "reason": safe_content, "tags": []}

            # DB上の神社にひも付け（簡易：名前の部分一致）
            shrine_obj = Shrine.objects.filter(name_jp__icontains=result["recommendation"]).first()
            result["shrine_id"] = shrine_obj.id if shrine_obj else None

            # 履歴保存（ログイン時のみ）
            if request.user.is_authenticated:
                ConciergeHistory.objects.create(
                    user=request.user,
                    shrine=shrine_obj,
                    reason=result.get("reason", ""),
                    tags=result.get("tags", []),
                )

            return Response(result, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
