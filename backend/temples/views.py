# backend/temples/views.py
from __future__ import annotations

import logging
import math
import os
from typing import Any, Dict

from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.db import models
from django.db.models import F, Value
from django.db.models.functions import Abs
from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404, render
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Shrine
from .route_service import Point as RoutePoint
from .route_service import build_route
from .serializers import (
    RouteRequestSerializer,
    ShrineSerializer,
)
from temples.services.concierge import make_plan
from temples.services.places import PlacesError, text_search_first

logger = logging.getLogger(__name__)


# -----------------------------
# Concierge（AIプラン）
# -----------------------------
def _normalize_candidate(cand: Dict[str, Any]) -> Dict[str, Any]:
    """
    name + area_hint をテキスト検索し、最上位ヒットを正規化。
    失敗しても最低限のキーは返す。
    """
    query = f"{cand.get('name','')} {cand.get('area_hint','')}".strip()
    hit: Dict[str, Any] | None = None
    try:
        hit = text_search_first(query)
    except PlacesError as e:
        logger.warning("places normalize failed: %s / %s", query, e)
    hit = hit or {}

    return {
        "name": cand.get("name"),
        "area_hint": cand.get("area_hint"),
        "reason": cand.get("reason"),
        "place_id": hit.get("place_id"),
        "address": hit.get("address") or hit.get("formatted_address"),
        "photo_url": hit.get("photo_url"),
        "location": hit.get("location"),  # {lat, lng} or None
    }


class ConciergePlanView(APIView):
    throttle_scope = "concierge"
    authentication_classes: list[Any] = []  # 公開API
    permission_classes = [AllowAny]

    def post(self, request):
        lat = request.data.get("lat")
        lng = request.data.get("lng")
        mode = request.data.get("mode", "walk")
        benefit = request.data.get("benefit", "")
        time_limit = request.data.get("time_limit")  # "2h" など（任意）

        plan = make_plan(lat, lng, benefit, mode, time_limit)
        main = _normalize_candidate(plan["main"])
        nearby = [_normalize_candidate(x) for x in plan["nearby"]]

        return Response(
            {
                "mode": plan.get("mode", mode),
                "main": main,
                "nearby": nearby,
            }
        )


# -----------------------------
# ルート計算（MVP）
# -----------------------------
class RouteAPIView(APIView):
    """
    POST /api/route/
    認証は MVP 段階では無し（必要になれば JWT に差し替え）
    """
    authentication_classes: list[Any] = []
    permission_classes = [AllowAny]

    def post(self, request):
        s = RouteRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data

        origin = RoutePoint(**data["origin"])
        destinations = [RoutePoint(**p) for p in data["destinations"]]
        result = build_route(data["mode"], origin, destinations)

        # Serializer での再検証は省略（クライアント合意のスキーマで返す）
        return Response(result)


# -----------------------------
# Shrine HTML（簡易）
# -----------------------------
def _is_shrine_owner(user, shrine) -> bool:
    """
    Shrine の所有者判定（User FK / M2M / プロパティ / Favorite フォールバック対応）
    スキーマが流動的でも落ちにくくする。
    """
    uid = getattr(user, "id", None)
    if uid is None:
        return False

    UserModel = get_user_model()

    # 1) 任意の User FK（created_by, owner 等）
    for f in shrine._meta.fields:
        if isinstance(f, models.ForeignKey):
            remote = getattr(f, "remote_field", None)
            model = getattr(remote, "model", None)
            if model is UserModel and getattr(shrine, f.attname) == uid:
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
        # 所有者スキーマの有無
        has_user_fk = any(
            isinstance(f, models.ForeignKey)
            and getattr(getattr(f, "remote_field", None), "model", None) is get_user_model()
            for f in shrine._meta.fields
        )
        has_owner_schema = has_user_fk or hasattr(shrine, "owners") or hasattr(shrine, "owner")

        # ルート計算用パラメータ
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


# -----------------------------
# Popular（モバイルHome用）
# -----------------------------
@method_decorator(cache_page(60), name="get")  # 60秒キャッシュ
class PopularShrinesView(ListAPIView):
    """
    - 可能なら popular_score / views_30d / favorites_30d / updated_at の順で降順
    - どれも無ければ -id で降順
    - ?near=lat,lng & radius_km=R があれば bbox で絞り、近似距離でセカンダリソート
    - レスポンスは **配列**（shrine-app と合致）
    """
    permission_classes = [AllowAny]
    throttle_scope = "places"
    serializer_class = ShrineSerializer

    def _field_names(self) -> set[str]:
        return {getattr(f, "name", "") for f in Shrine._meta.get_fields()}

    def get_queryset(self):
        fields = self._field_names()

        # 並び順（存在するものだけ反映）
        order_by: list[str] = []
        for cand in ("popular_score", "views_30d", "favorites_30d", "updated_at"):
            if cand in fields:
                order_by.append(f"-{cand}")
        if not order_by:
            order_by = ["-id"]

        qs = Shrine.objects.all().order_by(*order_by)

        # 近接検索（latitude/longitude がある場合のみ）
        params = self.request.GET
        near = params.get("near")
        radius_km = params.get("radius_km")

        has_latlng = "latitude" in fields and "longitude" in fields
        if near and radius_km and has_latlng:
            try:
                lat, lng = [float(v) for v in near.split(",")]
                r_km = float(radius_km)

                # 度⇄km の概算
                lat_delta = r_km / 111.32
                lng_delta = r_km / (111.32 * max(0.000001, math.cos(math.radians(lat))))

                qs = qs.filter(
                    latitude__gte=lat - lat_delta,
                    latitude__lte=lat + lat_delta,
                    longitude__gte=lng - lng_delta,
                    longitude__lte=lng + lng_delta,
                ).annotate(
                    _approx_deg=Abs(F("latitude") - Value(lat)) + Abs(F("longitude") - Value(lng))
                ).order_by(*order_by, "_approx_deg")
            except Exception:
                # パラメータ不正は無視
                pass

        return qs

    def list(self, request, *args, **kwargs):
        # limit（1..50）
        try:
            limit = int(request.GET.get("limit", 10))
        except Exception:
            limit = 10
        limit = max(1, min(50, limit))

        queryset = self.get_queryset()[:limit]
        data = self.get_serializer(queryset, many=True).data
        # shrine-app 互換のため配列を返す
        return Response(data)
