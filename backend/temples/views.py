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
from temples.serializers import PopularShrineSerializer
from .serializers import (
     RouteRequestSerializer,
     RouteResponseSerializer,
 )


from .models import Shrine



from .route_service import build_route, Point as RoutePoint

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


class PopularShrinesView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        limit = int(request.GET.get("limit", 10))
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

