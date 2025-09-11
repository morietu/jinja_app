# import math
import re

# import requests
import unicodedata
from urllib.parse import unquote_to_bytes
from django.http import HttpResponse
from django.core.cache import cache
from django.conf import settings
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page

from rest_framework import viewsets, permissions, status, serializers
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.authentication import JWTAuthentication

# 上流呼び出しは google_places に統一（tests がここを patch します）
from .services import google_places as gp
from .services.places import get_or_sync_place, PlacesError

from .models import Shrine, Favorite, PlaceRef
from .api.serializers import (
    ShrineSerializer,
    FavoriteSerializer,
    FavoriteUpsertSerializer,
)

REPLACEMENT_CHAR = "\ufffd"
MAX_Q = getattr(settings, "PLACES_MAX_QUERY_LEN", 200)


def _robust_get_query_param(request, name: str) -> str:
    """
    request.GET で U+FFFD が混入していたら、
    生の QUERY_STRING から name の値を bytes として取り直し、
    UTF-8 → CP932 → Shift_JIS の順に再デコードする。
    """
    val = (request.GET.get(name) or "").strip()
    if val and REPLACEMENT_CHAR not in val:
        # 置換されてなければ従来の軽い補正だけ
        return _maybe_fix_mojibake(val)

    raw_qs = request.META.get("QUERY_STRING", "")
    # name=... を抜き出し
    m = re.search(r"(?:^|&)" + re.escape(name) + r"=([^&]*)", raw_qs)
    if not m:
        return val
    raw_enc = m.group(1)

    # '+' はスペース扱い、%XX はバイト化
    try:
        raw_bytes = unquote_to_bytes(raw_enc.replace("+", " "))
    except Exception:
        return val

    # 正規の UTF-8 ならそれでOK
    try:
        return raw_bytes.decode("utf-8")
    except Exception:
        pass
    # Windows/CP932 → Shift_JIS の順で試す
    for enc in ("cp932", "shift_jis"):
        try:
            return raw_bytes.decode(enc)
        except Exception:
            continue
    return val


def _parse_locationbias_center_and_radius(lb: str):
    """
    locationbias から (center(lat,lng), location="lat,lng", radius(int or None)) を取り出す。
    circle と point にだけ対応。失敗時は (None, None, None)。
    """
    if not lb:
        return None, None, None
    try:
        lb = lb.strip()
        if lb.startswith("circle:"):
            # 例: circle:1500@35.715,139.797
            rest = lb.split("circle:", 1)[1]
            radius_s, at = rest.split("@", 1)
            radius_i = int(float(radius_s))
            lat_s, lng_s = at.split(",", 1)
            clat, clng = float(lat_s), float(lng_s)
            return (clat, clng), f"{clat},{clng}", radius_i
        if lb.startswith("point:"):
            # 例: point:35.715,139.797
            coord = lb.split("point:", 1)[1]
            lat_s, lng_s = coord.split(",", 1)
            clat, clng = float(lat_s), float(lng_s)
            return (clat, clng), f"{clat},{clng}", None
    except Exception:
        pass
    return None, None, None


def _is_shinto_shrine_row(r: dict) -> bool:
    types = set(r.get("types") or [])
    name = r.get("name") or ""
    lname = name.lower()

    if "buddhist_temple" in types:
        return False

    # type / 典型和名 / 典型英名
    jp_keywords = ("神社", "稲荷", "八幡", "天神", "天満宮", "神宮")
    en_keywords = (
        "shinto_shrine",
        "jinja",
        "jingu",
        "hachiman",
        "inari",
        "tenjin",
        "shrine",
    )

    if "shinto_shrine" in types:
        return True
    if any(k in name for k in jp_keywords):
        return True
    if any(k in lname for k in en_keywords) and ("temple" not in lname):
        return True

    return False


def _normalize_name(s: str) -> str:
    # 空白除去・小文字化のみの簡易正規化（日本語にも無害）
    return re.sub(r"\s+", "", (s or "")).lower()


def _name_equals_query(name: str, q: str) -> bool:
    """
    完全一致の緩和版：
    ・全角/半角の括弧で囲まれた注記（例: （本殿）, (Asakusa Shrine)）を削除
    ・空白を削除
    ・小文字化
    """

    def norm(x: str) -> str:
        x = x or ""
        # 全角/半角の括弧内を除去（（…）/(...)）
        x = re.sub(r"[（(].*?[）)]", "", x)
        # NFKC 正規化で全半/類似記号を吸収 → 空白削除 → 小文字化
        x = unicodedata.normalize("NFKC", x)
        x = re.sub(r"\s+", "", x).lower()
        return x

    return norm(name) == norm(q)


def _distance2_from(center, r: dict) -> float:
    """中心(center=(lat,lng))からの簡易距離（二乗）。centerが無ければ0。"""
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
    """
    0: 完全一致, 1: 前方一致, 2: 部分一致, 3: その他
    正規化して判定（大文字小文字・空白の差を吸収）
    """
    # ★ 完全一致は最優先
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
    """
    マッチ度 → 距離（近いほど先）→ rating 降順 → user_ratings_total 降順
    """

    def key(r):
        return (
            _match_bucket(r.get("name") or "", q),
            _distance2_from(center, r),
            -(r.get("rating") or 0),
            -(r.get("user_ratings_total") or 0),
        )

    return sorted(results or [], key=key)


def _inject_exact_match(q: str, location: str, radius_i: int, data: dict):
    """
    Text Search/Nearby のどちらにも q と（緩和した）完全一致の name が無ければ、
    候補を探して先頭に挿入。best-effort。
    """
    if not (
        q
        and location
        and radius_i
        and isinstance(data, dict)
        and isinstance(data.get("results"), list)
    ):
        return

    results = data["results"]

    # 既に（緩和した）完全一致があるなら何もしない
    if any(_name_equals_query(r.get("name"), q) for r in results):
        return

    try:
        exacts = []

        def _collect(rows):
            for r in rows or []:
                if _is_shinto_shrine_row(r) and _name_equals_query(r.get("name"), q):
                    exacts.append(r)

        # 0) Find Place（名前に強い）
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

        # 1) Text Search（素の q）
        _collect(
            gp.text_search(
                query=q, location=location, radius=radius_i, language="ja", region="jp"
            ).get("results")
        )

        # 2) Text Search（神社バイアス）
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

        # 3) Nearby（最後の保険）
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
            exacts,
            key=lambda r: ((r.get("rating") or 0), (r.get("user_ratings_total") or 0)),
        )
        existing_ids = {r.get("place_id") for r in results}
        if best.get("place_id") not in existing_ids:
            results.insert(0, best)  # 先頭固定（ここでは再ソートしない）

    except Exception:
        pass


def _maybe_fix_mojibake(s: str) -> str:
    """
    Windows コンソール等からの生 URL で起こる典型的なモジバケを簡易補正。
    CP932/SJIS バイト列を UTF-8 と誤解して送られたような場合に効く。
    失敗時はそのまま返す。
    """
    try:
        # 0x80–0x9F の制御領域っぽい文字が混じる場合は怪しいので補正を試みる
        if any("\x80" <= ch <= "\x9f" for ch in s):
            return s.encode("latin1", "ignore").decode("cp932", "ignore")
    except Exception:
        pass
    return s


# Google place_id の簡易フォーマット
PLACE_ID_RE = re.compile(r"^[A-Za-z0-9._=-]{10,200}$")


# PlacesSearchView を神社専用に絞り込み
class PlacesSearchView(APIView):
    authentication_classes = []
    permission_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "places"

    def get(self, request, *args, **kwargs):
        q = (
            _robust_get_query_param(request, "q")
            or _robust_get_query_param(request, "query")
            or ""
        ).strip()
        if not q:
            return Response(
                {"detail": "q is required"}, status=status.HTTP_400_BAD_REQUEST
            )
        q = q[:MAX_Q]

        # 位置バイアスは明示的指定時のみ
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
                    {"detail": "radius must be >= 1"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            radius_i = min(radius_i, 50000)

        # 神社にバイアス
        q_bias = q if ("神社" in q) else f"{q} 神社"

        try:
            params = dict(query=q_bias, language="ja", region="jp")
            if location and radius_i:
                params.update(location=location, radius=radius_i)
            else:
                # 無指定のときだけ settings の既定バイアスを使う（あれば）
                default_loc = getattr(settings, "PLACES_TEXT_DEFAULT_LOCATION", None)
                default_radius = getattr(settings, "PLACES_TEXT_DEFAULT_RADIUS_M", None)
                if default_loc and default_radius:
                    params.update(location=default_loc, radius=int(default_radius))

            data = gp.text_search(**params)

            # フィルタ
            filtered = [
                r for r in (data.get("results") or []) if _is_shinto_shrine_row(r)
            ]

            # center 算出（並べ替え用）
            center = None
            if location:
                try:
                    lat_s, lng_s = location.split(",")
                    center = (float(lat_s), float(lng_s))
                except Exception:
                    center = None

            # 並べ替え
            data["results"] = _sort_results_for_query(filtered, q, center=center)

            # 完全一致注入（位置があるときのみ）
            if location and radius_i:
                _inject_exact_match(q, location, radius_i, data)

            # それでも空なら Nearby フォールバック
            if not data["results"] and location and radius_i:
                nb = gp.nearby_search(
                    location=location,
                    radius=radius_i,
                    keyword=q or "神社",
                    opennow=False,
                    type_=None,
                    language="ja",
                )
                nb_filtered = [
                    r for r in (nb.get("results") or []) if _is_shinto_shrine_row(r)
                ]
                nb["results"] = _sort_results_for_query(nb_filtered, q, center=center)
                if nb["results"]:
                    data = nb
                    _inject_exact_match(q, location, radius_i, data)

            return Response(data, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)


class PlacesTextSearchPagedView(APIView):
    authentication_classes = []
    permission_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "places"

    def get(self, request):
        pagetoken = request.GET.get("pagetoken")
        q = (
            _robust_get_query_param(request, "q")
            or _robust_get_query_param(request, "query")
            or ""
        ).strip()
        if not pagetoken and not q:
            return Response(
                {"detail": "q is required"}, status=status.HTTP_400_BAD_REQUEST
            )
        q = q[:MAX_Q]

        # 神社バイアス
        q_bias = q if ("神社" in q) else f"{q} 神社"

        lat = request.GET.get("lat")
        lng = request.GET.get("lng")
        location = f"{lat},{lng}" if (lat and lng) else None
        radius = request.GET.get("radius")
        radius_i = int(radius) if radius else None

        # 実効位置（未指定時は既定値を適用）—キャッシュキーと検索、ソートで統一して使う
        eff_location = location
        eff_radius_i = radius_i
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
            # 検索パラメータ（実効位置をそのまま使う）
            search_kwargs = dict(
                query=q_bias,
                location=eff_location,
                radius=eff_radius_i,
                pagetoken=pagetoken,
                language="ja",
                region="jp",
            )

            data = gp.text_search(**search_kwargs)

            # フィルタ
            filtered = [
                r for r in (data.get("results") or []) if _is_shinto_shrine_row(r)
            ]

            # center 算出（並べ替え用）
            center = None
            if eff_location:
                try:
                    lat_s, lng_s = eff_location.split(",")
                    center = (float(lat_s), float(lng_s))
                except Exception:
                    center = None

            # 並べ替え
            data["results"] = _sort_results_for_query(filtered, q, center=center)

            # 完全一致注入（位置があるときのみ・最初のページのみ）
            if eff_location and eff_radius_i and not pagetoken:
                _inject_exact_match(q, eff_location, eff_radius_i, data)

            cache.set(cache_key, data, ttl)
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)


class PlacesNearbySearchView(APIView):
    authentication_classes = []
    permission_classes = []
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
                    {
                        "detail": "lat, lng, radius are required (unless pagetoken provided)"
                    },
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
            # 1) Nearby 実行 → 神社だけ残す
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

            # 2) 「マッチ度 → 距離 → rating → 口コミ数」で並べ替え
            data["results"] = _sort_results_for_query(filtered, keyword, center=center)

            # 3) 完全一致が出ていなければ Nearby で補完して先頭に注入（重複回避）
            if location and radius_i and not pagetoken and keyword:
                _inject_exact_match(keyword, location, radius_i, data)
                # ここでは再ソートしない：注入した完全一致を先頭に固定したいのでそのままにする

            # 4) （依然空なら）Text Search にフォールバック＋並べ替え
            if not data["results"] and location and radius_i and not pagetoken:
                q_bias = keyword if ("神社" in keyword) else f"{keyword} 神社"
                ts = gp.text_search(
                    query=q_bias,
                    location=location,
                    radius=radius_i,
                    language="ja",
                    region="jp",
                )
                ts_filtered = [
                    r for r in (ts.get("results") or []) if _is_shinto_shrine_row(r)
                ]
                ts["results"] = _sort_results_for_query(
                    ts_filtered, keyword, center=center
                )
                return Response(ts, status=status.HTTP_200_OK)

            return Response(data, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)


# ビュー全体をキャッシュ（2回目以降は gp.photo を呼ばない）
@method_decorator(
    cache_page(getattr(settings, "PLACES_PHOTO_CACHE_SECONDS", 86400)), name="get"
)
class PlacesPhotoProxyView(APIView):
    authentication_classes = []
    permission_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "places"

    def get(self, request, *args, **kwargs):
        ref = request.query_params.get("photo_reference")
        if not ref:
            return Response(
                {"detail": "photo_reference is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        maxwidth = request.query_params.get("maxwidth")
        maxheight = request.query_params.get("maxheight")
        maxwidth = int(maxwidth) if maxwidth else None
        maxheight = int(maxheight) if maxheight else None

        try:
            body, content_type = gp.photo(ref, maxwidth=maxwidth, maxheight=maxheight)
            resp = HttpResponse(
                body, content_type=content_type, status=status.HTTP_200_OK
            )
            max_age = int(getattr(settings, "PLACES_PHOTO_CACHE_SECONDS", 86400))
            resp["Cache-Control"] = f"public, max-age={max_age}"
            return resp
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)


class ShrineViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Shrine.objects.all().order_by("id")
    serializer_class = ShrineSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.AllowAny]


class FavoriteViewSet(viewsets.ModelViewSet):
    serializer_class = FavoriteSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            Favorite.objects.select_related("shrine")
            .filter(user=self.request.user)
            .order_by("-id")
        )

    def get_serializer_class(self):
        if self.request.method in ("POST", "PUT", "PATCH"):
            return FavoriteUpsertSerializer
        return FavoriteSerializer

    def create(self, request, *args, **kwargs):
        # alias: accept "shrine" as "shrine_id"
        data = request.data.copy()
        if "shrine" in data and "shrine_id" not in data:
            data["shrine_id"] = data.pop("shrine")

        # ★ alias 後の data から評価する
        shrine_id = data.get("shrine_id")
        place_id = data.get("place_id")
        if not shrine_id and not place_id:
            return Response(
                {"detail": "either shrine_id or place_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            if place_id:
                if not PLACE_ID_RE.match(place_id):
                    return Response(
                        {"detail": "invalid place_id format"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                get_or_sync_place(place_id)
                obj, created = Favorite.objects.get_or_create(
                    user=request.user, place_id=place_id
                )

                places = {}
                pr = (
                    PlaceRef.objects.filter(pk=obj.place_id)
                    .only("place_id", "name", "address", "latitude", "longitude")
                    .first()
                )
                if pr:
                    places[obj.place_id] = pr
                data = FavoriteSerializer(obj, context={"places": places}).data
            else:
                obj, created = Favorite.objects.get_or_create(
                    user=request.user, shrine_id=shrine_id
                )
                data = FavoriteSerializer(obj).data

        except PlacesError as e:
            return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)

        return Response(
            data, status=(status.HTTP_201_CREATED if created else status.HTTP_200_OK)
        )


class PlacesDetailView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "places"

    def get(self, request, place_id: str):
        if not PLACE_ID_RE.match(place_id):
            return Response(
                {"detail": "invalid place_id format"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            details = gp.place_details(
                place_id,
                language="ja",
                fields="place_id,name,formatted_address,geometry",
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


# ---- ルート API（バリデーションのみ：テスト要件どおり）----
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
    mode = serializers.ChoiceField(
        choices=["walking", "driving", "bicycling", "transit"]
    )
    origin = LatLngSerializer()
    destinations = LatLngSerializer(many=True, allow_empty=False)

    def validate_destinations(self, value):
        if len(value) > 5:
            raise serializers.ValidationError("too many destinations")
        return value


class RouteAPIView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        s = RouteRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data

        from math import radians, sin, cos, asin, sqrt

        def haversine_m(a: dict, b: dict) -> float:
            R = 6371000.0
            lat1, lon1 = radians(a["lat"]), radians(a["lng"])
            lat2, lon2 = radians(b["lat"]), radians(b["lng"])
            dlat = lat2 - lat1
            dlon = lon2 - lon1
            h = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
            return 2 * R * asin(sqrt(h))

        speed_mps = {
            "walking": 1.3,
            "bicycling": 5.5,
            "driving": 13.9,
            "transit": 8.33,
        }[data["mode"]]

        legs = []
        total_m = 0.0
        total_s = 0.0
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

        provider = getattr(settings, "ROUTE_PROVIDER", "dummy")  # ★追加

        return Response(
            {
                "ok": True,
                "provider": provider,  # ★追加
                "mode": data["mode"],
                "origin": data["origin"],
                "destinations": data["destinations"],
                "legs": legs,
                "distance_m_total": int(total_m),
                "duration_s_total": int(total_s),
            }
        )


# --- Find Place API ---
class PlacesFindPlaceView(APIView):
    authentication_classes = []
    permission_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "places"

    def get(self, request):
        # ここは必ず半角スペース4つのインデントにしてください（タブ・全角不可）
        input_text = _robust_get_query_param(request, "input")
        if not input_text:
            return Response(
                {"detail": "input is required"}, status=status.HTTP_400_BAD_REQUEST
            )
        input_text = input_text[:MAX_Q]

        language = request.GET.get("language", "ja")
        locationbias = request.GET.get("locationbias")
        fields = request.GET.get("fields")  # 未指定なら gp 側のデフォルトが効く

        # locationbias のパース（center と radius を抽出）
        center, location, radius_i = _parse_locationbias_center_and_radius(locationbias)

        # キャッシュ（Text 検索と同じ TTL を流用）
        ttl = getattr(settings, "PLACES_TEXT_CACHE_SECONDS", 300)
        lb_norm = f"{center[0]},{center[1]}" if center else ""
        cache_key = f"places:find:{language}:{input_text}:{lb_norm}:{radius_i or ''}:{fields or ''}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached, status=status.HTTP_200_OK)

        try:
            data = gp.find_place_text(
                input_text,
                language=language,
                locationbias=locationbias,
                fields=fields,  # None のときはクライアント側の既定 fields を自動付与
            )

            # 上流のエラーを明示
            if data.get("status") not in ("OK", "ZERO_RESULTS"):
                # Google のエラー内容をできるだけ透過
                msg = (
                    data.get("error_message") or data.get("status") or "upstream error"
                )
                return Response({"detail": msg}, status=status.HTTP_502_BAD_GATEWAY)

            # 神社のみ残す
            filtered = [
                r for r in (data.get("results") or []) if _is_shinto_shrine_row(r)
            ]
            data["results"] = _sort_results_for_query(
                filtered, input_text, center=center
            )

            if location and radius_i:
                _inject_exact_match(input_text, location, radius_i, data)

            if not data["results"]:
                # キーワードに神社バイアス（未指定時のみ付与）
                q_bias = input_text if ("神社" in input_text) else f"{input_text} 神社"

                # 2a) Text Search
                ts = gp.text_search(
                    query=q_bias,
                    location=location,
                    radius=radius_i,
                    language="ja",
                    region="jp",
                )
                ts_filtered = [
                    r for r in (ts.get("results") or []) if _is_shinto_shrine_row(r)
                ]
                ts["results"] = _sort_results_for_query(
                    ts_filtered, input_text, center=center
                )

                if ts["results"]:
                    cache.set(cache_key, ts, ttl)
                    return Response(ts, status=status.HTTP_200_OK)

                # 2b) Nearby（Text でも出なければ最後の保険）
                if location and radius_i:
                    nb = gp.nearby_search(
                        location=location,
                        radius=radius_i,
                        keyword=input_text,
                        language="ja",
                        type_=None,
                        opennow=False,
                    )
                    nb_filtered = [
                        r for r in (nb.get("results") or []) if _is_shinto_shrine_row(r)
                    ]
                    nb["results"] = _sort_results_for_query(
                        nb_filtered, input_text, center=center
                    )
                    cache.set(cache_key, nb, ttl)
                    return Response(nb, status=status.HTTP_200_OK)

            cache.set(cache_key, data, ttl)
            return Response(data, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)
