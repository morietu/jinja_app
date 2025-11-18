# backend/temples/api/views/concierge.py
from __future__ import annotations

import json
import math
import os
import re

from django.db.models import Prefetch
from openai import OpenAI
from rest_framework import generics, permissions, serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status


from rest_framework.views import APIView
from temples.api.serializers.concierge import (
    ConciergeHistorySerializer,
    ConciergeRecommendationsQuery,
    ConciergeRecommendationsResponse,
    ShrineNearbySerializer,
    ConciergeThreadSerializer,
    ConciergeThreadDetailSerializer,
    ConciergePlanRequestSerializer,
)

from temples.models import ConciergeHistory, GoriyakuTag, Shrine, ConciergeThread

from temples.services.concierge_history import append_chat
from temples.llm.orchestrator import ConciergeOrchestrator




def _haversine_m(lat1, lon1, lat2, lon2):
    """2点間の距離[m]（球面近似）"""
    R = 6371000.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

class ConciergeChatView(APIView):
    schema = None
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = "concierge"

    def post(self, request):
        data = request.data or {}

        # message / query を統一して扱う
        text = (data.get("message") or data.get("query") or "").strip()

        def to_float(v):
            try:
                return float(v)
            except Exception:
                return None

        lat = to_float(data.get("lat"))
        lng = to_float(data.get("lng"))
        transport = (data.get("transport") or "walking").lower()

        # ここで candidates を受け取る（テストで渡している）
        candidates = data.get("candidates") or []

        # 必須チェック（従来ロジックを維持）
        missing = []
        if not text:
            missing.append("message|query")
        if lat is None:
            missing.append("lat(float)")
        if lng is None:
            missing.append("lng(float)")
        if missing:
            return Response({"detail": f"required: {', '.join(missing)}"}, status=400)

        # smoke 互換の echo reply
        reply = f"echo: {text}"

        # --- Orchestrator に message + candidates を渡す（テストがここを検証） ---
        suggestions = None
        try:
            orchestrator = ConciergeOrchestrator()
            suggestions = orchestrator.suggest(query=text, candidates=candidates)
        except Exception:
            # LLMまわりで例外が起きても、チャット自体は 200 で返す
            suggestions = None

        # --- チャット履歴保存（従来ロジックを生かす） ---
        thread_payload = None
        thread_id = data.get("thread_id") or data.get("threadId")

        if request.user.is_authenticated:
            try:
                save_result = append_chat(
                    user=request.user,
                    query=text,
                    reply_text=reply,
                    thread_id=int(thread_id) if thread_id else None,
                )
                t = save_result.thread
                thread_payload = {
                    "id": t.id,
                    "title": t.title,
                    "last_message": t.last_message,
                    "last_message_at": t.last_message_at.isoformat() if t.last_message_at else None,
                    "message_count": t.message_count,
                }
            except Exception:
                thread_payload = None

        # --- レスポンス組み立て ---
        body: dict[str, object] = {
            "ok": True,
            "reply": reply,
        }
        if suggestions is not None:
            body["suggestions"] = suggestions
        if thread_payload is not None:
            body["thread"] = thread_payload

        return Response(body, status=status.HTTP_200_OK)

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

        origin_label = None

        # 起点を決める（lat/lng 優先 → q を geocode）
        # 位置ラベルだけ付ける（座標生成や外部呼び出しはしない）
        if lat is not None and lng is not None:
            origin_label = "origin"
        elif q:
            # ひとまずクエリ文字列をラベルに採用（外部APIには依存しない）
            origin_label = q
            pass

        # ベースQuery（座標未設定は除外）
        qs = (
            Shrine.objects.exclude(latitude__isnull=True)
            .exclude(longitude__isnull=True)
            .exclude(location__isnull=True)
            .prefetch_related(
                Prefetch("goriyaku_tags", queryset=GoriyakuTag.objects.only("id", "name"))
            )
        )

        if theme:
            qs = qs.filter(goriyaku_tags__name__icontains=theme).distinct()

        # 一旦候補を少し多めに拾ってから Python 側で距離付け→ソート
        candidates = list(qs.only("id", "name_jp", "address", "latitude", "longitude")[:50])

        rows = []
        for s in candidates:
            item = {
                "id": s.id,
                "name_jp": s.name_jp,
                "address": s.address,
                "latitude": float(s.latitude),
                "longitude": float(s.longitude),
            }
            if lat is not None and lng is not None:
                try:
                    item["distance_m"] = _haversine_m(
                        float(lat), float(lng), float(s.latitude), float(s.longitude)
                    )
                except Exception:
                    item["distance_m"] = None
            item["goriyaku_tags"] = [{"id": t.id, "name": t.name} for t in s.goriyaku_tags.all()]
            rows.append(item)

        if lat is not None and lng is not None:
            rows.sort(key=lambda r: (r.get("distance_m") is None, r.get("distance_m") or 0.0))

        rows = rows[:limit]

        data = {"results": ShrineNearbySerializer(rows, many=True).data}
        if lat is not None and lng is not None:
            data["origin"] = {"lat": float(lat), "lng": float(lng)}
            if origin_label:  # q から推定した場合などのラベル
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


def _get_openai_client():
    """OPENAI_API_KEY が未設定でも import 時に例外にならないよう遅延初期化."""
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        return None
    try:
        return OpenAI(api_key=key)
    except Exception:
        return None


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

        zodiac_animals = [
            "申",
            "酉",
            "戌",
            "亥",
            "子",
            "丑",
            "寅",
            "卯",
            "辰",
            "巳",
            "午",
            "未",
        ]
        zodiac = zodiac_animals[birth_year % 12]

        prompt = f"""
        あなたは日本の神社コンシェルジュです。
        ユーザーの生年月日は {birth_year}年{birth_month or ""}月{birth_day or ""}日 です。
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

        # --- OpenAI クライアントを遅延取得（ENV未設定なら 503 応答） ---
        client = _get_openai_client()
        if client is None:
            return Response(
                {"error": "OPENAI_API_KEY is not configured."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful Shinto shrine concierge.",
                    },
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


class ConciergeThreadListView(generics.ListAPIView):
    """
    GET /api/concierge-threads/
    """
    serializer_class = ConciergeThreadSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            ConciergeThread.objects
            .filter(user=self.request.user)
            .order_by("-last_message_at", "-id")
        )


class ConciergeThreadDetailView(generics.RetrieveAPIView):
    """
    GET /api/concierge-threads/<id>/
    """
    serializer_class = ConciergeThreadDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # N+1 防止で messages を一括取得
        return (
            ConciergeThread.objects
            .filter(user=self.request.user)
            .prefetch_related(
                "messages",
            )
        )

# ==== Fallback for ConciergePlanView (safety net) ====
from drf_spectacular.utils import extend_schema
from drf_spectacular.types import OpenApiTypes

try:
    ConciergePlanView  # type: ignore[name-defined]
except NameError:
    class ConciergePlanView(APIView):  # type: ignore[misc]
        permission_classes = [AllowAny]
        throttle_scope = "concierge"

        @extend_schema(
            summary="Concierge trip plan (stub)",
            description="レガシー互換用の簡易プランAPIスタブです。",
            request=ConciergePlanRequestSerializer,
            responses={200: OpenApiTypes.OBJECT},
            tags=["concierge"],
        )
        def post(self, request, *args, **kwargs):
            return Response(
                {"ok": True, "note": "stub plan endpoint"},
                status=status.HTTP_200_OK,
            )

    class ConciergePlanViewLegacy(ConciergePlanView):  # type: ignore[misc]
        schema = None

    # 関数スタイルビューもここで保証
    plan = ConciergePlanView.as_view()
    plan_legacy = ConciergePlanViewLegacy.as_view()

    # __all__ にも念のため足しておく
    try:
        __all__  # type: ignore[name-defined]
    except NameError:
        __all__ = []

    for name in [
        "plan",
        "plan_legacy",
        "ConciergePlanView",
        "ConciergePlanViewLegacy",
    ]:
        if name not in __all__:
            __all__.append(name)


class ConciergeChatViewLegacy(ConciergeChatView):
    schema = None
