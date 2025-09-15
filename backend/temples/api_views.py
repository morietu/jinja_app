import re
import unicodedata
from urllib.parse import unquote_to_bytes
from math import radians, sin, cos, asin, sqrt
from typing import List, Dict, Any

from django.conf import settings
from django.core.cache import cache
from django.db.models import Q
from django.http import HttpResponse
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from django.views.decorators.csrf import csrf_exempt

from rest_framework import status, viewsets, permissions, serializers
from rest_framework.parsers import JSONParser, FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import Goshuin, Shrine, Favorite, PlaceRef
from .serializers import GoshuinSerializer
from .api.serializers import ShrineSerializer, FavoriteSerializer, FavoriteUpsertSerializer
from .services import google_places as gp
from .services.places import get_or_sync_place, PlacesError
from .serializers_concierge import ConciergePlanRequestSerializer, AiPlanSerializer
from .services.openai_planner import build_ai_plan_or_none

REPLACEMENT_CHAR = "\ufffd"
MAX_Q = getattr(settings, "PLACES_MAX_QUERY_LEN", 200)
EARTH_KM = 6371.0088

def haversine_km(lat1, lon1, lat2, lon2) -> float:
    lat1, lon1, lat2, lon2 = float(lat1), float(lon1), float(lat2), float(lon2)
    dlat = radians(lat2 - lat1)
    dlon = radians(lat2 - lon1)
    a = sin(dlat/2)**2 + cos(radians(lat1))*cos(radians(lat2))*sin(dlon/2)**2
    return 2 * EARTH_KM * asin(sqrt(a))

# ===== Goshuin =====

class PublicGoshuinViewSet(viewsets.ReadOnlyModelViewSet):
    """誰でも閲覧できる公開御朱印一覧"""
    queryset = Goshuin.objects.filter(is_public=True).select_related("shrine")
    serializer_class = GoshuinSerializer
    permission_classes = [permissions.AllowAny]

class GoshuinViewSet(viewsets.ReadOnlyModelViewSet):
    """公開 + （認証済みなら）自分の非公開も含める一覧（読む専用）"""
    permission_classes = [permissions.AllowAny]
    serializer_class = GoshuinSerializer

    def get_queryset(self):
        qs = Goshuin.objects.select_related("shrine")
        user = getattr(self.request, "user", None)
        if user and user.is_authenticated:
            return qs.filter(is_public=True) | qs.filter(user=user)
        return qs.filter(is_public=True)

class MyGoshuinViewSet(viewsets.ModelViewSet):
    """自分の御朱印（閲覧＋投稿・更新・削除）"""
    serializer_class = GoshuinSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        # 自分のものだけ（他人IDは404）
        return Goshuin.objects.filter(user=self.request.user).select_related("shrine")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

# ===== Shrines / Nearby =====

def _haversine_local(lat1, lng1, lat2, lng2) -> float:
    R = 6371.0088
    dlat = radians(lat2 - lat1)
    dlon = radians(lng2 - lng1)
    a = sin(dlat/2)**2 + cos(radians(lat1))*cos(radians(lat2))*sin(dlon/2)**2
    return 2 * R * asin(sqrt(a))

class NearbyShrinesView(APIView):
    """
    GET /api/shrines/nearby/?lat=35.68&lng=139.76&radius=1500&limit=3
    """
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

        qs = (
            Shrine.objects.filter(
                Q(latitude__gte=lat - lat_delta) & Q(latitude__lte=lat + lat_delta) &
                Q(longitude__gte=lng - lng_delta) & Q(longitude__lte=lng + lng_delta)
            )
            .values("id", "name_jp", "address", "latitude", "longitude")
        )

        items: List[Dict[str, Any]] = []
        for s in qs:
            d = _haversine_local(lat, lng, s["latitude"], s["longitude"])
            if d <= radius_km:
                s["distance"] = round(d, 3)
                items.append(s)

        items.sort(key=lambda x: x["distance"])
        return Response(items[:limit], status=200)

@method_decorator(csrf_exempt, name="dispatch")
class ShrineViewSet(viewsets.ModelViewSet):
    queryset = Shrine.objects.all().order_by("-id")
    serializer_class = ShrineSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def perform_create(self, serializer):
        # created_by がモデルにあれば自動付与
        if any(getattr(f, "name", "") == "created_by" for f in Shrine._meta.get_fields()):
            serializer.save(created_by=self.request.user)
        else:
            serializer.save()

# ===== Favorites =====

PLACE_ID_RE = re.compile(r"^[A-Za-z0-9._=-]{10,200}$")

@method_decorator(csrf_exempt, name="dispatch")
class FavoriteViewSet(viewsets.ModelViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def get_queryset(self):
        return Favorite.objects.select_related("shrine").filter(user=self.request.user).order_by("-id")

    def get_serializer_class(self):
        if self.request.method in ("POST", "PUT", "PATCH"):
            return FavoriteUpsertSerializer
        return FavoriteSerializer

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        if "shrine" in data and "shrine_id" not in data:
            data["shrine_id"] = data.pop("shrine")

        shrine_id = data.get("shrine_id")
        place_id  = data.get("place_id")
        if not shrine_id and not place_id:
            return Response({"detail": "either shrine_id or place_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if place_id:
                if not PLACE_ID_RE.match(place_id):
                    return Response({"detail": "invalid place_id format"}, status=status.HTTP_400_BAD_REQUEST)
                get_or_sync_place(place_id)
                obj, created = Favorite.objects.get_or_create(user=request.user, place_id=place_id)
                places = {}
                pr = PlaceRef.objects.filter(pk=obj.place_id).only("place_id", "name", "address", "latitude", "longitude").first()
                if pr:
                    places[obj.place_id] = pr
                payload = FavoriteSerializer(obj, context={"places": places}).data
            else:
                obj, created = Favorite.objects.get_or_create(user=request.user, shrine_id=shrine_id)
                payload = FavoriteSerializer(obj).data
        except PlacesError as e:
            return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)

        return Response(payload, status=(status.HTTP_201_CREATED if created else status.HTTP_200_OK))

# ===== Places helper =====

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
    try:
        return raw_bytes.decode("utf-8")
    except Exception:
        pass
    for enc in ("cp932", "shift_jis"):
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

def _normalize_name(s: str) -> str:
    return re.sub(r"\s+", "", (s or "")).lower()

def _name_equals_query(name: str, q: str) -> bool:
    def norm(x: str) -> str:
        x = re.sub(r"[（(].*?[）)]", "", x or "")
        x = unicodedata.normalize("NFKC", x)
        x = re.sub(r"\s+", "", x).lower()
        return x
    return norm(name) == norm(q)

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
        return (_match_bucket(r.get("name") or "", q),
                _distance2_from(center, r),
                -(r.get("rating") or 0),
                -(r.get("user_ratings_total") or 0))
    return sorted(results or [], key=key)

def _inject_exact_match(q: str, location: str, radius_i: int, data: dict):
    if not (q and location and radius_i and isinstance(data, dict) and isinstance(data.get("results"), list)):
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
                q, language="ja",
                locationbias=f"circle:{radius_i}@{location}",
                fields="place_id,name,geometry,types,rating,user_ratings_total",
            )
            _collect(fp.get("results"))
        except Exception:
            pass
        _collect(gp.text_search(query=q, location=location, radius=radius_i, language="ja", region="jp").get("results"))
        if not exacts and "神社" not in q:
            _collect(gp.text_search(query=f"{q} 神社", location=location, radius=radius_i, language="ja", region="jp").get("results"))
        if not exacts:
            _collect(gp.nearby_search(location=location, radius=radius_i, keyword=q, opennow=False, type_=None, language="ja").get("results"))
        if not exacts:
            return
        best = max(exacts, key=lambda r: ((r.get("rating") or 0), (r.get("user_ratings_total") or 0)))
        existing_ids = {r.get("place_id") for r in results}
        if best.get("place_id") not in existing_ids:
            results.insert(0, best)
    except Exception:
        pass

# ===== Places API =====

class PlacesSearchView(APIView):
    authentication_classes = []
    permission_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "places"

    def get(self, request, *args, **kwargs):
        q = (_robust_get_query_param(request, "q") or _robust_get_query_param(request, "query") or "").strip()
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
                return Response({"detail": "radius must be int"}, status=status.HTTP_400_BAD_REQUEST)
            if radius_i < 1:
                return Response({"detail": "radius must be >= 1"}, status=status.HTTP_400_BAD_REQUEST)
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
                nb = gp.nearby_search(location=location, radius=radius_i, keyword=q or "神社", opennow=False, type_=None, language="ja")
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
    permission_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "places"

    def get(self, request):
        pagetoken = request.GET.get("pagetoken")
        q = (_robust_get_query_param(request, "q") or _robust_get_query_param(request, "query") or "").strip()
        if not pagetoken and not q:
            return Response({"detail": "q is required"}, status=status.HTTP_400_BAD_REQUEST)
        q = q[:MAX_Q]
        q_bias = q if ("神社" in q) else f"{q} 神社"
        lat = request.GET.get("lat")
        lng = request.GET.get("lng")
        location = f"{lat},{lng}" if (lat and lng) else None
        radius = request.GET.get("radius")
        radius_i = int(radius) if radius else None
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
            search_kwargs = dict(query=q_bias, location=eff_location, radius=eff_radius_i, pagetoken=pagetoken, language="ja", region="jp")
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
                return Response({"detail": "lat, lng, radius are required (unless pagetoken provided)"}, status=status.HTTP_400_BAD_REQUEST)
            try:
                clat, clng = float(lat), float(lng)
                radius_i = int(radius)
            except ValueError:
                return Response({"detail": "lat/lng must be float, radius must be int"}, status=status.HTTP_400_BAD_REQUEST)
            location = f"{lat},{lng}"
            center = (clat, clng)
        else:
            location = None
            radius_i = 0
        try:
            data = gp.nearby_search(location=location, radius=radius_i, keyword=keyword, type_=None, opennow=opennow, pagetoken=pagetoken, language="ja")
            raw = data.get("results") or []
            filtered = [r for r in raw if _is_shinto_shrine_row(r)]
            data["results"] = _sort_results_for_query(filtered, keyword, center=center)
            if location and radius_i and not pagetoken and keyword:
                _inject_exact_match(keyword, location, radius_i, data)
            if not data["results"] and location and radius_i and not pagetoken:
                q_bias = keyword if ("神社" in keyword) else f"{keyword} 神社"
                ts = gp.text_search(query=q_bias, location=location, radius=radius_i, language="ja", region="jp")
                ts_filtered = [r for r in (ts.get("results") or []) if _is_shinto_shrine_row(r)]
                ts["results"] = _sort_results_for_query(ts_filtered, keyword, center=center)
                return Response(ts, status=status.HTTP_200_OK)
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)

# 写真プロキシ（キャッシュ付）
@method_decorator(cache_page(getattr(settings, "PLACES_PHOTO_CACHE_SECONDS", 86400)), name="get")
class PlacesPhotoProxyView(APIView):
    authentication_classes = []
    permission_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "places"

    def get(self, request):
        ref = request.query_params.get("photo_reference")
        if not ref:
            return Response({"detail": "photo_reference is required"}, status=status.HTTP_400_BAD_REQUEST)
        maxwidth = request.query_params.get("maxwidth")
        maxheight = request.query_params.get("maxheight")
        maxwidth = int(maxwidth) if maxwidth else None
        maxheight = int(maxheight) if maxheight else None
        try:
            body, content_type = gp.photo(ref, maxwidth=maxwidth, maxheight=maxheight)
            resp = HttpResponse(body, content_type=content_type, status=status.HTTP_200_OK)
            max_age = int(getattr(settings, "PLACES_PHOTO_CACHE_SECONDS", 86400))
            resp["Cache-Control"] = f"public, max-age={max_age}"
            return resp
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)

class PlacesFindPlaceView(APIView):
    authentication_classes = []
    permission_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "places"
    def get(self, request):
        input_text = _robust_get_query_param(request, "input")
        if not input_text:
            return Response({"detail": "input is required"}, status=status.HTTP_400_BAD_REQUEST)
        input_text = input_text[:MAX_Q]
        language = request.GET.get("language", "ja")
        locationbias = request.GET.get("locationbias")
        fields = request.GET.get("fields")
        center, location, radius_i = _parse_locationbias_center_and_radius(locationbias)
        ttl = getattr(settings, "PLACES_TEXT_CACHE_SECONDS", 300)
        lb_norm = f"{center[0]},{center[1]}" if center else ""
        cache_key = f"places:find:{language}:{input_text}:{lb_norm}:{radius_i or ''}:{fields or ''}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached, status=status.HTTP_200_OK)
        try:
            data = gp.find_place_text(input_text, language=language, locationbias=locationbias, fields=fields)
            if data.get("status") not in ("OK", "ZERO_RESULTS"):
                msg = data.get("error_message") or data.get("status") or "upstream error"
                return Response({"detail": msg}, status=status.HTTP_502_BAD_GATEWAY)
            filtered = [r for r in (data.get("results") or []) if _is_shinto_shrine_row(r)]
            data["results"] = _sort_results_for_query(filtered, input_text, center=center)
            if location and radius_i:
                _inject_exact_match(input_text, location, radius_i, data)
            if not data["results"]:
                q_bias = input_text if ("神社" in input_text) else f"{input_text} 神社"
                ts = gp.text_search(query=q_bias, location=location, radius=radius_i, language="ja", region="jp")
                ts_filtered = [r for r in (ts.get("results") or []) if _is_shinto_shrine_row(r)]
                ts["results"] = _sort_results_for_query(ts_filtered, input_text, center=center)
                if ts["results"]:
                    cache.set(cache_key, ts, ttl)
                    return Response(ts, status=status.HTTP_200_OK)
                if location and radius_i:
                    nb = gp.nearby_search(location=location, radius=radius_i, keyword=input_text, language="ja", type_=None, opennow=False)
                    nb_filtered = [r for r in (nb.get("results") or []) if _is_shinto_shrine_row(r)]
                    nb["results"] = _sort_results_for_query(nb_filtered, input_text, center=center)
                    cache.set(cache_key, nb, ttl)
                    return Response(nb, status=status.HTTP_200_OK)
            cache.set(cache_key, data, ttl)
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)

# ===== Route / Concierge =====

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
    permission_classes = []
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
        speed_mps = {"walking": 1.3, "bicycling": 5.5, "driving": 13.9, "transit": 8.33}[data["mode"]]
        legs, total_m, total_s = [], 0.0, 0.0
        current = data["origin"]
        for d in data["destinations"]:
            dist = haversine_m(current, d)
            dur = dist / speed_mps
            legs.append({"origin": current, "destination": d, "distance_m": int(dist), "duration_s": int(dur)})
            total_m += dist
            total_s += dur
            current = d
        provider = getattr(settings, "ROUTE_PROVIDER", "dummy")
        return Response({"ok": True, "provider": provider, "mode": data["mode"], "origin": data["origin"],
                         "destinations": data["destinations"], "legs": legs,
                         "distance_m_total": int(total_m), "duration_s_total": int(total_s)})

class ConciergePlanView(APIView):
    authentication_classes = []
    permission_classes = []
    def post(self, request):
        req = ConciergePlanRequestSerializer(data=request.data)
        req.is_valid(raise_exception=True)
        v = req.validated_data
        plan = build_ai_plan_or_none(prompt=v["prompt"], origin=v["origin"], mode=v["mode"], count=v["count"], radius_m=v["radius_m"])
        if plan is None:
            plan = {
                "title": "fallback: 近場おすすめプラン",
                "summary": "AIが利用できないため暫定プランを返しています。",
                "mode": v["mode"],
                "steps": [{"name": "サンプル神社A", "latitude": 35.68, "longitude": 139.76, "address": "東京都…", "stay_minutes": 20}],
            }
        res = AiPlanSerializer(data=plan)
        res.is_valid(raise_exception=True)
        return Response(res.data, status=status.HTTP_200_OK)
