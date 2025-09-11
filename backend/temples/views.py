import os

from django.http import HttpResponse, Http404
from django.shortcuts import render, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib.auth import get_user_model
from django.db import models
import math
from django.db.models import F, Value
from django.db.models.functions import Abs



from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status
from typing import Dict, Any
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from temples.serializers import PopularShrineSerializer
from .serializers import (
     RouteRequestSerializer,
     RouteResponseSerializer,
 )
from temples.services.places import text_search_first, PlacesError
from temples.services.concierge import make_plan
from temples.services.places import text_search_first  # 既存の軽ラッパを想定
from .models import Shrine
from .route_service import build_route, Point as RoutePoint


def normalize_candidate(cand: Dict[str, Any]) -> Dict[str, Any]:
    # name + area_hint でTextSearch → 1件目を採用（API側でランキング済み想定)
    """
    name + area_hint でTextSearch → 1件目を採用。
    失敗しても最低限（name/area_hint/reason）を返す。
    """
    query = f"{cand['name']} {cand['area_hint']}".strip()
    hit = text_search_first(query) or {}
    try:
        hit = text_search_first(query)
    except PlacesError as e:
        # ログだけ残してフォールバック
        logger = logging.getLogger(__name__)
        logger.warning("places normalize failed: %s / %s", query, e)
        hit = None

    hit = hit or {}
    return {
        "name": cand["name"],
        "area_hint": cand["area_hint"],
        "reason": cand["reason"],
        "place_id": hit.get("place_id"),
        "address": hit.get("address") or hit.get("formatted_address"),
        "photo_url": hit.get("photo_url"),
        "location": hit.get("location"),  # {lat, lng}（無ければNone）
    }

class ConciergePlanView(APIView):
    throttle_scope = "concierge"
    authentication_classes = []                # ← 追加（公開API）
    permission_classes = [AllowAny]            # ← 追加

    def post(self, request):
        lat   = request.data.get("lat")
        lng   = request.data.get("lng")
        mode  = request.data.get("mode", "walk")
        benefit = request.data.get("benefit", "")
        time_limit = request.data.get("time_limit")  # "2h" 等（任意）

        plan = make_plan(lat, lng, benefit, mode, time_limit)
        main = normalize_candidate(plan["main"])
        nearby = [normalize_candidate(x) for x in plan["nearby"]]

        return Response({
            "mode": plan["mode"],
            "main": main,
            "nearby": nearby
        }, status=status.HTTP_200_OK)


class ShrineListView(APIView):
    """URLリゾルバ用の最小スタブ。実装は後で差し替えます。"""
    def get(self, request, *args, **kwargs):
        return Response({"results": []})

class RouteView(APIView):
    """
    POST /api/route/
    認証は MVP 段階では無し（必要になれば JWT に差し替え）
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        s = RouteRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data

        origin = RoutePoint(**data["origin"])
        destinations = [RoutePoint(**p) for p in data["destinations"]]

        result = build_route(data["mode"], origin, destinations)

        # API 仕様は `from` キーのまま返す（Serializer 検証は行わない）
        return Response(result, status=status.HTTP_200_OK)


def _is_shrine_owner(user, shrine) -> bool:
    """
    Shrine の所有者判定（User FK / M2M / プロパティ / Favorite フォールバック対応）
    - スキーマが流動的な段階を考慮し、いくつかの候補を探索
    - 認可の暫定実装。将来的にはポリシーレイヤで統一する想定
    """
    uid = getattr(user, "id", None)
    if uid is None:
        return False

    # 1) User への任意の FK（created_by, author, owner など）を総当り
    UserModel = get_user_model()
    for f in shrine._meta.fields:
        if isinstance(f, models.ForeignKey):
            remote = getattr(f, "remote_field", None)
            model = getattr(remote, "model", None)
            if model is UserModel:
                if getattr(shrine, f.attname) == uid:  # '<field>_id'
                    return True

    # 2) M2M: owners
    owners_rel = getattr(shrine, "owners", None)
    if owners_rel is not None and hasattr(owners_rel, "filter"):
        try:
            if owners_rel.filter(pk=uid).exists():
                return True
        except Exception:
            pass

    # 3) プロパティ owner
    owner_obj = getattr(shrine, "owner", None)
    if owner_obj is not None and getattr(owner_obj, "pk", None) == uid:
        return True

    # 4) Favorite フォールバック
    try:
        from .models import Favorite
        if Favorite.objects.filter(user_id=uid, shrine_id=shrine.id).exists():
            return True
    except Exception:
        pass

    return False


def shrine_list(request):
    # URL 逆引き用の最小実装
    return HttpResponse("ok")

@method_decorator(cache_page(60), name="get")
class PopularShrinesView(APIView):

    permission_classes = [AllowAny]
    throttle_scope = "places"  # 既存のDEFAULT_THROTTLE_RATES["places"]を使用

    def get(self, request):
        # limitの堅牢化（1..50）
        try:
            limit = int(request.GET.get("limit", 10))
        except Exception:
            limit = 10
        limit = max(1, min(50, limit))
        near = request.GET.get("near")          # "lat,lng"
        radius_km = request.GET.get("radius_km")

        qs = Shrine.objects.all().order_by("-popular_score", "-updated_at")

        # 近接フィルタ：GIS関数なし版（バウンディングボックス＋近似距離でソート）
        if near and radius_km:
            try:
                lat, lng = [float(v) for v in near.split(",")]
                r_km = float(radius_km)
                # 1度あたりのkm換算（おおよそ）。緯度は一定、経度は緯度によって変動
                lat_delta = r_km / 111.32
                lng_delta = r_km / (111.32 * max(0.000001, math.cos(math.radians(lat))))
                # bboxで粗く絞り込み（FloatFieldのlatitude/longitudeを使用）
                qs = qs.filter(
                    latitude__gte=lat - lat_delta,
                    latitude__lte=lat + lat_delta,
                    longitude__gte=lng - lng_delta,
                    longitude__lte=lng + lng_delta,
                )
                # 近似距離（度のマンハッタン距離）でセカンダリソート
                qs = qs.annotate(
                    _approx_deg=Abs(F("latitude") - Value(lat)) + Abs(F("longitude") - Value(lng))
                ).order_by("-popular_score", "_approx_deg")
            except Exception:
                # パラメータ不正は無視してスコア順のみ
                pass

        data = PopularShrineSerializer(qs[:limit], many=True).data
        return Response({"items": data, "limit": limit})


@login_required
def shrine_detail(request, pk: int):
    shrine = get_object_or_404(Shrine, pk=pk)
    if not _is_shrine_owner(request.user, shrine):
        raise Http404()
    return HttpResponse(f"detail {shrine.pk}")


@login_required
def shrine_route(request, pk: int):
    """
    HTML での簡易ルート表示。オーナー制度が未スキーマの場合のみ lat/lng パラメータで暫定許可。
    """
    shrine = get_object_or_404(Shrine, pk=pk)

    ok = _is_shrine_owner(request.user, shrine)
    if not ok:
        # 所有者スキーマ（User FK / owners / owner）が存在するか
        has_user_fk = any(
            isinstance(f, models.ForeignKey)
            and getattr(getattr(f, "remote_field", None), "model", None) is get_user_model()
            for f in shrine._meta.fields
        )
        has_owner_schema = has_user_fk or hasattr(shrine, "owners") or hasattr(shrine, "owner")

        # ルート計算用パラメータが付いているか
        has_route_params = bool(request.GET.get("lat")) and bool(request.GET.get("lng"))

        # オーナー情報のスキーマが無い場合に限り、lat/lng があれば閲覧許可
        if not has_owner_schema and has_route_params:
            ok = True

    if not ok:
        raise Http404()

    ctx = {
        "shrine": shrine,
        "GOOGLE_MAPS_API_KEY": os.environ.get("GOOGLE_MAPS_API_KEY", ""),
    }
    return render(request, "temples/route.html", ctx)


@login_required
def favorite_toggle(request, pk: int):
    # URL 解決用の最小応答
    get_object_or_404(Shrine, pk=pk)
    return HttpResponse("ok")

