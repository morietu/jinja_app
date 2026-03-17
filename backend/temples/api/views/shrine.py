# -*- coding: utf-8 -*-
import math

from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import serializers
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

from django.conf import settings
from django.db.models import F, Q, Value
from django.db.models.functions import Coalesce

from rest_framework import filters
from rest_framework import status, viewsets
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.decorators import action

from temples.services.places import get_or_create_shrine_by_place_id, PlacesError
from rest_framework import serializers
from drf_spectacular.utils import extend_schema
from django.http import Http404
from django.db.models import Q
from temples.services import places

from temples.api.serializers.shrine import (
    ShrineDetailSerializer,
    ShrineListSerializer,
    ShrineWriteSerializer,
)
from temples.models import Shrine
from temples.queries import (
    nearest_queryset as q_nearest_queryset,
    nearest_shrines as q_nearest_shrines,
)

from temples.services.places_rank import (
  tokenize as _tokenize,
  is_parentish_token as _is_parentish_token,
  place_text as _place_text,
  count_contains as _count_contains,
  score_place,
)


EARTH_RADIUS_M = 6371000.0

# is_favorite 注釈はあれば使う
try:
    from temples.api.utils import annotate_is_favorite
except Exception:
    def annotate_is_favorite(qs, request):
        return qs


def _apply_q_terms(qs, params):
    q = (params.get("q") or "").strip()
    if not q:
        return qs

    terms = [t for t in q.replace("　", " ").split(" ") if t]
    if not terms:
        return qs

    qq = Q()
    for t in terms:
        qq |= (
            Q(name_jp__icontains=t)
            | Q(name_romaji__icontains=t)
            | Q(address__icontains=t)
            | Q(goriyaku__icontains=t)
            | Q(goriyaku_tags__name__icontains=t)
        )
    return qs.filter(qq)

def _use_real_gis() -> bool:
    return bool(getattr(settings, "USE_GIS", False)) and not bool(
        getattr(settings, "DISABLE_GIS_FOR_TESTS", False)
    )

class NearestShrineItemSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name_jp = serializers.CharField(required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True)
    latitude = serializers.FloatField(required=False)
    longitude = serializers.FloatField(required=False)
    distance = serializers.FloatField(required=False)

class NearestShrinesResponseSerializer(serializers.Serializer):
    results = NearestShrineItemSerializer(many=True)

@extend_schema_view(
    get=extend_schema(
        operation_id="api_shrines_nearest_list",
        responses={200: NearestShrinesResponseSerializer},
        tags=["shrines"],
    )
)
# ---- Legacy shim: /api/shrines/nearest/ を JSON 配列で返す ----
class NearestShrinesAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        q = (request.query_params.get("q") or "").strip()
        limit = int(request.query_params.get("limit") or 5)

        if not q or len(q) < 2:
            return Response({"results": []}, status=status.HTTP_200_OK)

        data = places.places_text_search({"query": q, "language": "ja", "region": "jp"})
        results = (data or {}).get("results") or []
        if not results:
            return Response({"results": []}, status=status.HTTP_200_OK)

        toks = _tokenize(q)
        parent_toks = [t for t in toks if _is_parentish_token(t)]

        # ✅ 元のトップが親っぽいなら、全面ソートしない（副作用を抑える）
        top_name, _ = _place_text(results[0])
        top_is_parent = any(_count_contains(top_name, pt) for pt in parent_toks) if     parent_toks else False

        scored = []
        for i, r in enumerate(results):
            try:
                s = score_place(q, r, base_rank=i)
            except Exception:
                s = 10_000 - i
            scored.append((s, i, r))

        if top_is_parent:
            # bestだけ先頭にできる権利を与える。残りはGoogle順のまま。
            best = max(scored, key=lambda x: (x[0], -x[1]))
            best_i = best[1]
            if best_i != 0:
                best_r = best[2]
                rest = [r for j, r in enumerate(results) if j != best_i]
                results = [best_r] + rest
            # best_i==0なら何もしない（Google順尊重）
        else:
            # トップが親じゃないなら全面リランク
            scored.sort(key=lambda x: (x[0], -x[1]), reverse=True)
            results = [r for _, _, r in scored]

        results = results[: max(1, min(limit, 10))]
        return Response({"results": results}, status=status.HTTP_200_OK)

# ---- Popular API（Visitへは依存しない）----
class PopularShrineListView(ListAPIView):
    serializer_class = ShrineListSerializer
    permission_classes = [AllowAny]
    throttle_scope = "shrines"

    def get_queryset(self):
        qs = Shrine.objects.all()
        params = self.request.query_params

        # kind（既定 shrine / ?kind=temple / ?kind=all）
        kind = (params.get("kind") or "shrine").lower()
        if kind in ("shrine", "temple"):
            qs = qs.filter(kind=kind)
        elif kind != "all":
            qs = qs.filter(kind="shrine")

        # q（単語分割 OR）
        qs = _apply_q_terms(qs, params)

        # name（任意）
        name = params.get("name")
        if name:
            qs = qs.filter(Q(name_jp__icontains=name) | Q(name_romaji__icontains=name))

        # near + radius_km の簡易BBOXフィルタ
        near = params.get("near")
        radius_km = params.get("radius_km")
        if near and radius_km:
            try:
                lat0, lng0 = [float(x) for x in near.split(",", 1)]
                r = float(radius_km)
                lat_delta = r / 111.0
                lng_delta = r / (111.0 * max(0.1, math.cos(math.radians(lat0))))
                qs = qs.filter(
                    latitude__gte=lat0 - lat_delta,
                    latitude__lte=lat0 + lat_delta,
                    longitude__gte=lng0 - lng_delta,
                    longitude__lte=lng0 + lng_delta,
                )
            except Exception:
                pass

        qs = annotate_is_favorite(qs, self.request)
        return (
            qs.annotate(popular_val=Coalesce(F("popular_score"), Value(0.0)))
              .order_by(F("popular_val").desc(nulls_last=True), "-id")
              .distinct()
        )


# ---- ランキング API ----
class RankingAPIView(ListAPIView):
    serializer_class = ShrineListSerializer
    permission_classes = [AllowAny]
    throttle_scope = "shrines"

    def get_queryset(self):
        qs = Shrine.objects.all()

        # kind（既定 shrine / ?kind=temple / ?kind=all）
        params = self.request.query_params
        kind = (params.get("kind") or "shrine").lower()
        if kind in ("shrine", "temple"):
            qs = qs.filter(kind=kind)
        elif kind != "all":
            qs = qs.filter(kind="shrine")
        qs = _apply_q_terms(qs, params)

        # 簡易BBOX（near=LAT,LNG & radius_km=R）
        near = params.get("near")
        radius_km = params.get("radius_km")
        if near and radius_km:
            try:
                lat0, lng0 = [float(x) for x in near.split(",", 1)]
                r = float(radius_km)
                lat_delta = r / 111.0
                lng_delta = r / (111.0 * max(0.1, math.cos(math.radians(lat0))))
                qs = qs.filter(
                    latitude__gte=lat0 - lat_delta,
                    latitude__lte=lat0 + lat_delta,
                    longitude__gte=lng0 - lng_delta,
                    longitude__lte=lng0 + lng_delta,
                )
            except Exception:
                pass  # パラメータ不正は無視

        qs = qs.annotate(popular_val=Coalesce(F("popular_score"), Value(0.0))) \
               .order_by("-popular_val", "-id")
        return qs

    


# ---- ShrineViewSet ----
class ShrineViewSet(viewsets.ModelViewSet):
    queryset = Shrine.objects.all()
    throttle_scope = "shrines"
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    filter_backends = [filters.SearchFilter]
    search_fields = ["name_jp", "name_romaji", "address", "goriyaku"]

    def get_permissions(self):
        if self.action in ("list", "nearest", "ingest"):
            return [AllowAny()]
        if self.action == "retrieve":
            return [IsAuthenticated()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return ShrineWriteSerializer
        if self.action in ("list", "nearest"):
            return ShrineListSerializer
        return ShrineDetailSerializer

    def get_throttles(self):
        if getattr(self, "action", None) == "ingest":
            self.throttle_scope = "shrines_ingest"
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        qs = super().get_queryset()

        if getattr(self, "action", None) == "retrieve":
            u = getattr(self.request, "user", None)
            if not u or not u.is_authenticated:
                return qs.none()

            if getattr(u, "is_staff", False) or getattr(u, "is_superuser", False):
                return qs.distinct()

            return qs.filter(owner=u).distinct()

        return qs.distinct()
    
    


    @action(
        detail=False,
        methods=["post"],
        url_path="ingest",
        permission_classes=[AllowAny],
        throttle_classes=[ScopedRateThrottle],
    )
    def ingest(self, request):
        place_id = (request.data or {}).get("place_id")
        if not place_id:
            return Response({"detail": "place_id is required"}, status=400)

        try:
            shrine = get_or_create_shrine_by_place_id(place_id)
            data = ShrineDetailSerializer(shrine, context={"request": request}).data
            data["place_id"] = place_id
            return Response(data, status=status.HTTP_200_OK)
        except PlacesError as e:
            return Response({"detail": str(e)}, status=getattr(e, "status", 502) or 502)
