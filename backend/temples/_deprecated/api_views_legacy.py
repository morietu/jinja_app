# backend/temples/api_views.py
# -*- coding: utf-8 -*-
import re
import unicodedata
from math import asin, cos, radians, sin, sqrt  # math 全体ではなく必要関数のみ
from typing import Any, Dict, List
from urllib.parse import unquote_to_bytes

from django.conf import settings
from django.core.cache import cache
from django.db.models import Q
from django.http import HttpResponse
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework.viewsets import ReadOnlyModelViewSet
from rest_framework_simplejwt.authentication import JWTAuthentication  # 認証が必要な所だけで使用
from temples.llm.backfill import _shorten_japanese_address as _S
from temples.llm.backfill import fill_locations
from temples.llm.orchestrator import chat_to_plan

from .api.serializers import FavoriteSerializer, FavoriteUpsertSerializer
from .models import Favorite, Goshuin, PlaceRef, Shrine
from .serializers import GoshuinSerializer, ShrineSerializer

# 上流呼び出しは google_places に統一
from .services import google_places as gp
from .services.places import PlacesError, get_or_sync_place

# ---- 定数・ユーティリティ -----------------------------------------------------
REPLACEMENT_CHAR = "\ufffd"
MAX_Q = getattr(settings, "PLACES_MAX_QUERY_LEN", 200)
EARTH_KM = 6371.0088


def haversine_km(lat1, lon1, lat2, lon2) -> float:
    lat1, lon1, lat2, lon2 = float(lat1), float(lon1), float(lat2), float(lon2)
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * EARTH_KM * asin(sqrt(a))


def _maybe_fix_mojibake(s: str) -> str:
    try:
        if any("\x80" <= ch <= "\x9f" for ch in s):
            return s.encode("latin1", "ignore").decode("cp932", "ignore")
    except Exception:
        pass
    return s


def _robust_get_query_param(request, name: str) -> str:
    val = (request.GET.get(name) or "").strip()
    if val and REPLACEMENT_CHAR not in val:
        return _maybe_fix_mojibake(val)
    raw_qs = request.META.get("QUERY_STRING", "")
    m = re.search(r"(?:^|&)" + re.escape(name) + r"=([^&]*)", raw_qs)
    if not m:
        return val
    raw_enc = m.group(1)
    try:
        raw_bytes = unquote_to_bytes(raw_enc.replace("+", " "))
    except Exception:
        return val
    for enc in ("utf-8", "cp932", "shift_jis"):
        try:
            return raw_bytes.decode(enc)
        except Exception:
            continue
    return val


def _parse_locationbias_center_and_radius(lb: str):
    if not lb:
        return None, None, None
    try:
        lb = lb.strip()
        if lb.startswith("circle:"):
            rest = lb.split("circle:", 1)[1]
            radius_s, at = rest.split("@", 1)
            radius_i = int(float(radius_s))
            lat_s, lng_s = at.split(",", 1)
            clat, clng = float(lat_s), float(lng_s)
            return (clat, clng), f"{clat},{clng}", radius_i
        if lb.startswith("point:"):
            coord = lb.split("point:", 1)[1]
            lat_s, lng_s = coord.split(",", 1)
            clat, clng = float(lat_s), float(lng_s)
            return (clat, clng), f"{clat},{clng}", None
    except Exception:
        pass
    return None, None, None


def _normalize_name(s: str) -> str:
    return re.sub(r"\s+", "", (s or "")).lower()


def _name_equals_query(name: str, q: str) -> bool:
    def norm(x: str) -> str:
        x = x or ""
        x = re.sub(r"[（(].*?[）)]", "", x)
        x = unicodedata.normalize("NFKC", x)
        x = re.sub(r"\s+", "", x).lower()
        return x

    return norm(name) == norm(q)


def _is_shinto_shrine_row(r: dict) -> bool:
    types = set(r.get("types") or [])
    name = r.get("name") or ""
    lname = name.lower()
    if "buddhist_temple" in types:
        return False
    jp_keywords = ("神社", "稲荷", "八幡", "天神", "天満宮", "神宮")
    en_keywords = ("shinto_shrine", "jinja", "jingu", "hachiman", "inari", "tenjin", "shrine")
    if "shinto_shrine" in types:
        return True
    if any(k in name for k in jp_keywords):
        return True
    if any(k in lname for k in en_keywords) and ("temple" not in lname):
        return True
    return False


def _distance2_from(center, r: dict) -> float:
    if not center:
        return 0.0
    if "lat" in r and "lng" in r:
        lat, lng = r["lat"], r["lng"]
    else:
        loc = (r.get("geometry") or {}).get("location") or {}
        lat, lng = loc.get("lat"), loc.get("lng")
    if lat is None or lng is None:
        return 1e18
    return (lat - center[0]) ** 2 + (lng - center[1]) ** 2


def _match_bucket(name: str, q: str) -> int:
    if _name_equals_query(name, q):
        return 0
    n = _normalize_name(name)
    qn = _normalize_name(q)
    if not qn:
        return 3
    if n == qn:
        return 0
    if n.startswith(qn):
        return 1
    if qn in n:
        return 2
    return 3


def _sort_results_for_query(results, q: str, center=None):
    def key(r):
        return (
            _match_bucket(r.get("name") or "", q),
            _distance2_from(center, r),
            -(r.get("rating") or 0),
            -(r.get("user_ratings_total") or 0),
        )

    return sorted(results or [], key=key)


def _inject_exact_match(q: str, location: str, radius_i: int, data: dict):
    if not (
        q
        and location
        and radius_i
        and isinstance(data, dict)
        and isinstance(data.get("results"), list)
    ):
        return
    results = data["results"]
    if any(_name_equals_query(r.get("name"), q) for r in results):
        return
    try:
        exacts = []

        def _collect(rows):
            for r in rows or []:
                if _is_shinto_shrine_row(r) and _name_equals_query(r.get("name"), q):
                    exacts.append(r)

        try:
            fp = gp.find_place_text(
                q,
                language="ja",
                locationbias=f"circle:{radius_i}@{location}",
                fields="place_id,name,geometry,types,rating,user_ratings_total",
            )
            _collect(fp.get("results"))
        except Exception:
            pass
        _collect(
            gp.text_search(
                query=q, location=location, radius=radius_i, language="ja", region="jp"
            ).get("results")
        )
        if not exacts and "神社" not in q:
            _collect(
                gp.text_search(
                    query=f"{q} 神社",
                    location=location,
                    radius=radius_i,
                    language="ja",
                    region="jp",
                ).get("results")
            )
        if not exacts:
            _collect(
                gp.nearby_search(
                    location=location,
                    radius=radius_i,
                    keyword=q,
                    opennow=False,
                    type_=None,
                    language="ja",
                ).get("results")
            )
        if not exacts:
            return
        best = max(
            exacts, key=lambda r: ((r.get("rating") or 0), (r.get("user_ratings_total") or 0))
        )
        existing_ids = {r.get("place_id") for r in results}
        if best.get("place_id") not in existing_ids:
            results.insert(0, best)
    except Exception:
        pass


# ---- 近隣神社検索 -------------------------------------------------------------
class NearbyShrinesView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            lat = float(request.GET.get("lat"))
            lng = float(request.GET.get("lng"))
        except (TypeError, ValueError):
            return Response({"detail": "lat,lng は必須です"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            radius_m = int(request.GET.get("radius", 1500))
        except ValueError:
            radius_m = 1500
        radius_m = max(100, min(radius_m, 10000))
        radius_km = radius_m / 1000.0
        try:
            limit = int(request.GET.get("limit", 3))
        except ValueError:
            limit = 3
        limit = max(1, min(limit, 20))
        lat_delta = radius_km / 110.574
        lng_den = 111.320 * max(0.000001, cos(radians(lat)))
        lng_delta = radius_km / lng_den
        qs = Shrine.objects.filter(
            Q(latitude__gte=lat - lat_delta)
            & Q(latitude__lte=lat + lat_delta)
            & Q(longitude__gte=lng - lng_delta)
            & Q(longitude__lte=lng + lng_delta)
        ).values("id", "name_jp", "address", "latitude", "longitude")
        items: List[Dict[str, Any]] = []
        for s in qs:
            d = haversine_km(lat, lng, s["latitude"], s["longitude"])
            if d <= radius_km:
                s["distance"] = round(d, 3)
                items.append(s)
        items.sort(key=lambda x: x["distance"])
        return Response(items[:limit], status=status.HTTP_200_OK)


# 互換エイリアス: 別の場所が ShrineNearbyView を期待しているため
ShrineNearbyView = NearbyShrinesView


# ---- Places API（検索・ページング・Nearby・写真・詳細） -----------------------
PLACE_ID_RE = re.compile(r"^[A-Za-z0-9._=-]{10,200}$")


class PlacesSearchView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "places"

    def get(self, request, *args, **kwargs):
        q = (
            _robust_get_query_param(request, "q") or _robust_get_query_param(request, "query") or ""
        ).strip()
        if not q:
            return Response({"detail": "q is required"}, status=status.HTTP_400_BAD_REQUEST)
        q = q[:MAX_Q]
        lat = request.query_params.get("lat")
        lng = request.query_params.get("lng")
        location = f"{lat},{lng}" if (lat and lng) else None
        radius_param = request.query_params.get("radius")
        radius_i = None
        if radius_param is not None:
            try:
                radius_i = int(radius_param)
            except (TypeError, ValueError):
                return Response(
                    {"detail": "radius must be int"}, status=status.HTTP_400_BAD_REQUEST
                )
            if radius_i < 1:
                return Response(
                    {"detail": "radius must be >= 1"}, status=status.HTTP_400_BAD_REQUEST
                )
            radius_i = min(radius_i, 50000)
        q_bias = q if ("神社" in q) else f"{q} 神社"
        try:
            params = dict(query=q_bias, language="ja", region="jp")
            if location and radius_i:
                params.update(location=location, radius=radius_i)
            else:
                default_loc = getattr(settings, "PLACES_TEXT_DEFAULT_LOCATION", None)
                default_radius = getattr(settings, "PLACES_TEXT_DEFAULT_RADIUS_M", None)
                if default_loc and default_radius:
                    params.update(location=default_loc, radius=int(default_radius))
            data = gp.text_search(**params)
            filtered = [r for r in (data.get("results") or []) if _is_shinto_shrine_row(r)]
            center = None
            if location:
                try:
                    lat_s, lng_s = location.split(",")
                    center = (float(lat_s), float(lng_s))
                except Exception:
                    center = None
            data["results"] = _sort_results_for_query(filtered, q, center=center)
            if location and radius_i:
                _inject_exact_match(q, location, radius_i, data)
            if not data["results"] and location and radius_i:
                nb = gp.nearby_search(
                    location=location,
                    radius=radius_i,
                    keyword=q or "神社",
                    opennow=False,
                    type_=None,
                    language="ja",
                )
                nb_filtered = [r for r in (nb.get("results") or []) if _is_shinto_shrine_row(r)]
                nb["results"] = _sort_results_for_query(nb_filtered, q, center=center)
                if nb["results"]:
                    data = nb
                    _inject_exact_match(q, location, radius_i, data)
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)


class PlacesTextSearchPagedView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "places"

    def get(self, request):
        pagetoken = request.GET.get("pagetoken")
        q = (
            _robust_get_query_param(request, "q") or _robust_get_query_param(request, "query") or ""
        ).strip()
        if not pagetoken and not q:
            return Response({"detail": "q is required"}, status=status.HTTP_400_BAD_REQUEST)
        q = q[:MAX_Q]
        q_bias = q if ("神社" in q) else f"{q} 神社"
        lat = request.GET.get("lat")
        lng = request.GET.get("lng")
        location = f"{lat},{lng}" if (lat and lng) else None
        radius = request.GET.get("radius")
        radius_i = int(radius) if radius else None
        eff_location, eff_radius_i = location, radius_i
        if not (eff_location and eff_radius_i) and not pagetoken:
            default_loc = getattr(settings, "PLACES_TEXT_DEFAULT_LOCATION", None)
            default_radius = getattr(settings, "PLACES_TEXT_DEFAULT_RADIUS_M", None)
            if default_loc and default_radius:
                eff_location = default_loc
                eff_radius_i = int(default_radius)
        ttl = getattr(settings, "PLACES_TEXT_CACHE_SECONDS", 300)
        cache_key = f"places:text:{q}:{eff_location or ''}:{eff_radius_i or ''}:{pagetoken or ''}:shinto_only"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached, status=status.HTTP_200_OK)
        try:
            search_kwargs = dict(
                query=q_bias,
                location=eff_location,
                radius=eff_radius_i,
                pagetoken=pagetoken,
                language="ja",
                region="jp",
            )
            data = gp.text_search(**search_kwargs)
            filtered = [r for r in (data.get("results") or []) if _is_shinto_shrine_row(r)]
            center = None
            if eff_location:
                try:
                    lat_s, lng_s = eff_location.split(",")
                    center = (float(lat_s), float(lng_s))
                except Exception:
                    center = None
            data["results"] = _sort_results_for_query(filtered, q, center=center)
            if eff_location and eff_radius_i and not pagetoken:
                _inject_exact_match(q, eff_location, eff_radius_i, data)
            cache.set(cache_key, data, ttl)
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)


class PlacesNearbySearchView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "places"

    def get(self, request):
        pagetoken = request.GET.get("pagetoken")
        keyword = (_robust_get_query_param(request, "keyword") or "神社").strip()
        opennow = (request.GET.get("opennow") or "").lower() in ("1", "true", "yes")
        keyword = keyword[:MAX_Q]
        center = None
        if not pagetoken:
            lat = request.GET.get("lat")
            lng = request.GET.get("lng")
            radius = request.GET.get("radius")
            if lat is None or lng is None or radius is None:
                return Response(
                    {"detail": "lat, lng, radius are required (unless pagetoken provided)"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                clat, clng = float(lat), float(lng)
                radius_i = int(radius)
            except ValueError:
                return Response(
                    {"detail": "lat/lng must be float, radius must be int"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            location = f"{lat},{lng}"
            center = (clat, clng)
        else:
            location = None
            radius_i = 0
        try:
            data = gp.nearby_search(
                location=location,
                radius=radius_i,
                keyword=keyword,
                type_=None,
                opennow=opennow,
                pagetoken=pagetoken,
                language="ja",
            )
            raw = data.get("results") or []
            filtered = [r for r in raw if _is_shinto_shrine_row(r)]
            data["results"] = _sort_results_for_query(filtered, keyword, center=center)
            if location and radius_i and not pagetoken and keyword:
                _inject_exact_match(keyword, location, radius_i, data)
            if not data["results"] and location and radius_i and not pagetoken:
                q_bias = keyword if ("神社" in keyword) else f"{keyword} 神社"
                ts = gp.text_search(
                    query=q_bias, location=location, radius=radius_i, language="ja", region="jp"
                )
                ts_filtered = [r for r in (ts.get("results") or []) if _is_shinto_shrine_row(r)]
                ts["results"] = _sort_results_for_query(ts_filtered, keyword, center=center)
                return Response(ts, status=status.HTTP_200_OK)
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)


@method_decorator(cache_page(getattr(settings, "PLACES_PHOTO_CACHE_SECONDS", 86400)), name="get")
class PlacesPhotoProxyView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "places"

    def get(self, request, *args, **kwargs):
        ref = request.query_params.get("photo_reference")
        if not ref:
            return Response(
                {"detail": "photo_reference is required"}, status=status.HTTP_400_BAD_REQUEST
            )
        maxwidth = request.query_params.get("maxwidth")
        maxheight = request.query_params.get("maxheight")
        maxwidth = int(maxwidth) if maxwidth else None
        maxheight = int(maxheight) if maxheight else None
        try:
            body, content_type = gp.photo(ref, maxwidth=maxwidth, maxheight=maxheight)
            resp = HttpResponse(body, content_type=content_type, status=status.HTTP_200_OK)
            resp["Cache-Control"] = (
                f"public, max-age={int(getattr(settings, 'PLACES_PHOTO_CACHE_SECONDS', 86400))}"
            )
            return resp
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)


class PlacesDetailView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "places"

    def get(self, request, place_id: str):
        if not re.match(r"^[A-Za-z0-9._=-]{10,200}$", place_id):
            return Response(
                {"detail": "invalid place_id format"}, status=status.HTTP_400_BAD_REQUEST
            )
        try:
            details = gp.place_details(
                place_id, language="ja", fields="place_id,name,formatted_address,geometry"
            )
            location = (details.get("geometry") or {}).get("location") or {}
            data = {
                "place_id": details.get("place_id"),
                "name": details.get("name"),
                "address": details.get("formatted_address"),
                "location": {"lat": location.get("lat"), "lng": location.get("lng")},
            }
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)


# ---- Places: place_id から Shrine を取得/作成 --------------------------------
PLACE_ID_RE = re.compile(r"^[A-Za-z0-9._=-]{10,200}$")


class PlacesFindPlaceView(APIView):
    """
    POST /api/places/find/
    Body: {"place_id": "<Google Place ID>"}
    - PlaceRef を同期/取得
    - 既に Shrine が紐付いていればそれを返す
    - 無ければ PlaceRef の name/address/latitude/longitude から Shrine を作成し、PlaceRef に紐付けて返す
    """

    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "places"

    def post(self, request, *args, **kwargs):
        try:
            place_id = (request.data or {}).get("place_id")
            if not place_id:
                return Response({"detail": "place_id is required"}, status=400)
            if not PLACE_ID_RE.match(place_id):
                return Response({"detail": "invalid place_id format"}, status=400)

            # 1) Googleと同期して PlaceRef を取得（なければ作る）
            pr: PlaceRef = get_or_sync_place(place_id)

            # 2) 既に Shrine が紐付いていればそれを返す
            shrine = getattr(pr, "shrine", None)
            if shrine and getattr(shrine, "id", None):
                return Response(
                    {"id": shrine.id, "shrine_id": shrine.id, "place_id": place_id},
                    status=200,
                )

            # 3) Shrine 未作成なら PlaceRef の情報から作成
            name = getattr(pr, "name", "") or ""
            address = getattr(pr, "address", "") or ""
            lat = getattr(pr, "latitude", None)
            lng = getattr(pr, "longitude", None)
            if lat is None or lng is None:
                return Response({"detail": "place has no geometry on PlaceRef"}, status=502)

            shrine = Shrine.objects.create(
                name_jp=name,
                address=address,
                latitude=lat,
                longitude=lng,
            )

            # 4) PlaceRef に Shrine をひも付け（FK がある前提）
            #    モデルに合わせてフィールド名が違うなら pr.shrine_id = shrine.id 等に変更
            if hasattr(pr, "shrine"):
                pr.shrine = shrine
                pr.save(update_fields=["shrine"])

            return Response(
                {"id": shrine.id, "shrine_id": shrine.id, "place_id": place_id},
                status=201,
            )

        except PlacesError as e:
            return Response({"detail": str(e)}, status=502)
        except Exception as e:
            # ここで丸めて 500。メッセージは出す
            return Response({"detail": "internal error", "error": str(e)}, status=500)


# ---- Shrine / Favorite / Goshuin API -----------------------------------------
class ShrineViewSet(ReadOnlyModelViewSet):
    """
    /api/shrines/ 一覧・詳細（安全版）
    """

    queryset = Shrine.objects.all().order_by("id")
    serializer_class = ShrineSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["address"]  # 例
    search_fields = ["name_jp", "address"]  # 例
    ordering_fields = ["id"]


class FavoriteViewSet(viewsets.ModelViewSet):
    serializer_class = FavoriteSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            Favorite.objects.select_related("shrine").filter(user=self.request.user).order_by("-id")
        )

    def get_serializer_class(self):
        if self.request.method in ("POST", "PUT", "PATCH"):
            return FavoriteUpsertSerializer
        return FavoriteSerializer

    def create(self, request, *args, **kwargs):
        data = request.data or {}

        # shrine でも shrine_id でも受ける
        shrine_id = data.get("shrine_id") or data.get("shrine")
        place_id = data.get("place_id")

        if not shrine_id and not place_id:
            return Response(
                {"detail": "either shrine_id or place_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # ---- place_id でお気に入り追加（PlaceRef 同期 → Favorite(place_id=PlaceRef.pk)）----
            if place_id:
                if not PLACE_ID_RE.match(place_id):
                    return Response(
                        {"detail": "invalid place_id format"}, status=status.HTTP_400_BAD_REQUEST
                    )

                # PlaceRef を同期/取得（services.places.get_or_sync_place）
                pr = get_or_sync_place(place_id)

                obj, created = Favorite.objects.get_or_create(
                    user=request.user,
                    # ★ Favorite の place_id には「PlaceRef の整数PK」を入れる設計
                    place_id=pr.pk,
                )

                # Serializer に PlaceRef を渡して展開させる場合のコンテキスト
                payload = FavoriteSerializer(obj, context={"places": {pr.pk: pr}}).data
                return Response(
                    payload, status=(status.HTTP_201_CREATED if created else status.HTTP_200_OK)
                )

            # ---- shrine_id でお気に入り追加 ----
            obj, created = Favorite.objects.get_or_create(
                user=request.user,
                shrine_id=int(shrine_id),
            )
            payload = FavoriteSerializer(obj).data
            return Response(
                payload, status=(status.HTTP_201_CREATED if created else status.HTTP_200_OK)
            )

        except PlacesError as e:
            return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)


class PublicGoshuinViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Goshuin.objects.filter(is_public=True).select_related("shrine")
    serializer_class = GoshuinSerializer
    permission_classes = [AllowAny]


class MyGoshuinViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = GoshuinSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Goshuin.objects.filter(user=self.request.user).select_related("shrine")


class GoshuinViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = GoshuinSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = Goshuin.objects.select_related("shrine")
        user = getattr(self.request, "user", None)
        if user and user.is_authenticated:
            return qs.filter(is_public=True) | qs.filter(user=user)
        return qs.filter(is_public=True)


# ---- ルート API（ダミー距離計算） ---------------------------------------------
class LatLngSerializer(serializers.Serializer):
    lat = serializers.FloatField()
    lng = serializers.FloatField()

    def validate_lat(self, v):
        if not (-90.0 <= v <= 90.0):
            raise serializers.ValidationError("lat out of range")
        return v

    def validate_lng(self, v):
        if not (-180.0 <= v <= 180.0):
            raise serializers.ValidationError("lng out of range")
        return v


class RouteRequestSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=["walking", "driving", "bicycling", "transit"])
    origin = LatLngSerializer()
    destinations = LatLngSerializer(many=True, allow_empty=False)

    def validate_destinations(self, value):
        if len(value) > 5:
            raise serializers.ValidationError("too many destinations")
        return value


class RouteAPIView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        s = RouteRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data

        def haversine_m(a: dict, b: dict) -> float:
            R = 6371000.0
            lat1, lon1 = radians(a["lat"]), radians(a["lng"])
            lat2, lon2 = radians(b["lat"]), radians(b["lng"])
            dlat = lat2 - lat1
            dlon = lon2 - lon1
            h = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
            return 2 * R * asin(sqrt(h))

        speed_mps = {"walking": 1.3, "bicycling": 5.5, "driving": 13.9, "transit": 8.33}[
            data["mode"]
        ]
        legs, total_m, total_s = [], 0.0, 0.0
        current = data["origin"]
        for d in data["destinations"]:
            dist = haversine_m(current, d)
            dur = dist / speed_mps
            legs.append(
                {
                    "origin": current,
                    "destination": d,
                    "distance_m": int(dist),
                    "duration_s": int(dur),
                }
            )
            total_m += dist
            total_s += dur
            current = d
        provider = getattr(settings, "ROUTE_PROVIDER", "dummy")
        return Response(
            {
                "ok": True,
                "provider": provider,
                "mode": data["mode"],
                "origin": data["origin"],
                "destinations": data["destinations"],
                "legs": legs,
                "distance_m_total": int(total_m),
                "duration_s_total": int(total_s),
            },
            status=status.HTTP_200_OK,
        )


# --- stub: PlacesFindPlaceView (urlsのimport解決用) ---


class ConciergeChatView(APIView):
    """
    POST /api/concierge/chat/
    Body: {"message": str, "location": {"lat": float, "lng": float}, "transport": "walking"|"driving"|"transit"}
    """

    authentication_classes = []  # 匿名OK（MVP）
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "concierge"

    def post(self, request):
        try:
            body = request.data or {}
            msg = (body.get("message") or "").strip()

            loc = body.get("location") or {}
            # lat/lng が無い/壊れている場合は東京駅にフォールバック
            lat = float(loc.get("lat") or 35.6812)
            lng = float(loc.get("lng") or 139.7671)

            transport = (body.get("transport") or "walking").strip() or "walking"

            plan = chat_to_plan(msg, lat, lng, transport)
            return Response(plan, status=200)

        except ValueError:
            return Response({"detail": "Invalid location"}, status=400)
        except Exception as e:
            return Response({"detail": "internal error", "error": str(e)}, status=500)

    def get(self, request):
        # 動作確認用
        return Response(
            {"ok": True, "hint": "POST JSON: {message, location:{lat,lng}, transport}"}, status=200
        )


class ConciergeHistoryView(APIView):
    """
    GET /api/temples/concierge/history/
    フロント既存実装に合わせた互換スタブ。必要なら後でDB連携に差し替え。
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        # ひとまず空配列でOK。必要なら最近のプランなどを返す実装に置き換え。
        return Response([], status=200)


class ConciergePlanView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        payload = request.data or {}

        def _safe_float(v):
            try:
                return float(v)
            except Exception:
                return None

        lat = _safe_float(payload.get("lat"))
        lng = _safe_float(payload.get("lng"))

        radius_m = payload.get("radius_m")
        radius_km = payload.get("radius_km")
        try:
            if radius_m is not None:
                radius_m = float(radius_m)
            elif radius_km is not None:
                radius_m = float(radius_km) * 1000.0
        except Exception:
            radius_m = None

        # 最大 50km にクリップ
        if isinstance(radius_m, (int, float)):
            radius_m = max(0.0, min(float(radius_m), 50_000.0))

        bias = {"lat": lat, "lng": lng, "radius_m": radius_m}

        query = (payload.get("query") or "").strip()
        candidates = payload.get("candidates") or []
        area = payload.get("area") or ""

        # 1) LLM（互換シム）
        llm_out = chat_to_plan(query, candidates=candidates, area=area) or {}

        # 2) recommendations を最低1件保証
        recs = list(llm_out.get("recommendations") or [])
        try:
            import logging

            logging.getLogger(__name__).debug("CONCIERGE DEBUG initial_recs: %s", recs)
        except Exception:
            pass
        if not recs:
            if candidates:
                first_name = (
                    candidates[0].get("name") or candidates[0].get("place_id") or "近隣の神社"
                )
                recs = [{"name": first_name, "reason": "暫定"}]
            else:
                recs = [{"name": "近隣の神社", "reason": "暫定"}]

        # area があれば先頭に短縮住所
        if area and recs:
            try:
                short = _S(area)
            except Exception:
                short = area
            if isinstance(recs[0], dict):
                recs[0] = {**recs[0], "location": short}
        try:
            import logging

            logging.getLogger(__name__).debug("CONCIERGE DEBUG after_area_recs: %s", recs)
        except Exception:
            pass

        # 3) backfill（空なら recs を維持）
        base_payload = {"recommendations": recs}
        try:
            import logging

            logging.getLogger(__name__).debug("CONCIERGE DEBUG base_payload: %s", base_payload)
        except Exception:
            pass
        filled = fill_locations(base_payload, candidates=recs, bias=bias, shorten=True) or {}
        try:
            import logging

            logging.getLogger(__name__).debug("CONCIERGE DEBUG filled: %s", filled)
        except Exception:
            pass
        filled_recs = filled.get("recommendations") or []
        final_recs = filled_recs if filled_recs else recs
        try:
            import logging

            logging.getLogger(__name__).debug("CONCIERGE DEBUG final_recs: %s", final_recs)
        except Exception:
            pass

        data = {"recommendations": final_recs}

        # デバッグ: テスト出力で中身を確認（後で削除）
        try:
            import logging

            logging.getLogger(__name__).debug("CONCIERGE DEBUG data: %s", data)
        except Exception:
            pass

        # 4) {"data": ...} で返す（テスト期待に合わせる）
        return Response({"data": data}, status=200)
