# backend/temples/api_views.py（抜粋・置換用）
import math
import re
import requests
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
from .api.serializers import ShrineSerializer, FavoriteSerializer, FavoriteUpsertSerializer

# Google place_id の簡易フォーマット
PLACE_ID_RE = re.compile(r"^[A-Za-z0-9._=-]{10,200}$")


class PlacesSearchView(APIView):
    authentication_classes = []
    permission_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "places"

    def get(self, request, *args, **kwargs):
        q = (request.query_params.get("q") or request.query_params.get("query") or "").strip()
        if not q:
            return Response({"detail": "q is required"}, status=status.HTTP_400_BAD_REQUEST)

        lat = request.query_params.get("lat")
        lng = request.query_params.get("lng")
        location = f"{lat},{lng}" if lat and lng else None

        radius = request.query_params.get("radius")
        radius_i = int(radius) if radius else None

        try:
            data = gp.text_search(query=q, location=location, radius=radius_i, language="ja", region="jp")
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
        q = (request.GET.get("q") or "").strip()
        if not pagetoken and not q:
            return Response({"detail": "q is required"}, status=status.HTTP_400_BAD_REQUEST)

        type_ = request.GET.get("type")
        opennow = (request.GET.get("opennow") or "").lower() in ("1", "true", "yes")

        lat = request.GET.get("lat")
        lng = request.GET.get("lng")
        location = f"{lat},{lng}" if (lat and lng) else None

        radius = request.GET.get("radius")
        radius_i = int(radius) if radius else None

        # 手動キャッシュ（KEY_FUNCTION により memcached-safe になる）
        ttl = getattr(settings, "PLACES_TEXT_CACHE_SECONDS", 300)
        cache_key = f"places:text:{q}:{location or ''}:{radius_i or ''}:{type_ or ''}:{'1' if opennow else '0'}:{pagetoken or ''}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached, status=status.HTTP_200_OK)

        try:
            data = gp.text_search(
                query=q,
                location=location,
                radius=radius_i,
                type_=type_,
                open_now=opennow,
                pagetoken=pagetoken,
            )
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
        keyword = request.GET.get("keyword")
        type_ = request.GET.get("type")
        opennow = (request.GET.get("opennow") or "").lower() in ("1", "true", "yes")

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
                float(lat); float(lng)
                radius_i = int(radius)
            except ValueError:
                return Response({"detail": "lat/lng must be float, radius must be int"},
                                status=status.HTTP_400_BAD_REQUEST)
            location = f"{lat},{lng}"
        else:
            # pagetoken がある場合、上流は token のみ見ればOK
            location = None
            radius_i = 0

        try:
            data = gp.nearby_search(
                location=location,
                radius=radius_i,
                keyword=keyword,
                type_=type_,
                opennow=opennow,   # ← Google側は opennow パラメータ
                pagetoken=pagetoken,
            )
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)


# ビュー全体をキャッシュ（2回目以降は gp.photo を呼ばない）
@method_decorator(cache_page(getattr(settings, "PLACES_PHOTO_CACHE_SECONDS", 86400)), name="get")
class PlacesPhotoProxyView(APIView):
    authentication_classes = []
    permission_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "places"

    def get(self, request, *args, **kwargs):
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
        return Favorite.objects.select_related("shrine").filter(user=self.request.user).order_by("-id")

    def get_serializer_class(self):
        if self.request.method in ("POST", "PUT", "PATCH"):
            return FavoriteUpsertSerializer
        return FavoriteSerializer

    def create(self, request, *args, **kwargs):
        shrine_id = request.data.get("shrine_id")
        place_id = request.data.get("place_id")

        if not shrine_id and not place_id:
            return Response({"detail": "either shrine_id or place_id is required"},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            if place_id:
                if not PLACE_ID_RE.match(place_id):
                    return Response({"detail": "invalid place_id format"}, status=status.HTTP_400_BAD_REQUEST)
                get_or_sync_place(place_id)
                obj, created = Favorite.objects.get_or_create(user=request.user, place_id=place_id)

                places = {}
                pr = (PlaceRef.objects.filter(pk=obj.place_id)
                      .only("place_id", "name", "address", "latitude", "longitude").first())
                if pr:
                    places[obj.place_id] = pr
                data = FavoriteSerializer(obj, context={"places": places}).data
            else:
                obj, created = Favorite.objects.get_or_create(user=request.user, shrine_id=shrine_id)
                data = FavoriteSerializer(obj).data

        except PlacesError as e:
            return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)

        return Response(data, status=(status.HTTP_201_CREATED if created else status.HTTP_200_OK))


class PlacesDetailView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "places"

    def get(self, request, place_id: str):
        if not PLACE_ID_RE.match(place_id):
            return Response({"detail": "invalid place_id format"}, status=status.HTTP_400_BAD_REQUEST)

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

        from math import radians, sin, cos, asin, sqrt

        def haversine_m(a: dict, b: dict) -> float:
            R = 6371000.0
            lat1, lon1 = radians(a["lat"]), radians(a["lng"])
            lat2, lon2 = radians(b["lat"]), radians(b["lng"])
            dlat = lat2 - lat1
            dlon = lon2 - lon1
            h = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
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
            legs.append({
                "origin": current,
                "destination": d,
                "distance_m": int(dist),
                "duration_s": int(dur),
            })
            total_m += dist
            total_s += dur
            current = d

        provider = getattr(settings, "ROUTE_PROVIDER", "dummy")  # ★追加

        return Response({
            "ok": True,
            "provider": provider,                     # ★追加
            "mode": data["mode"],
            "origin": data["origin"],
            "destinations": data["destinations"],
            "legs": legs,
            "distance_m_total": int(total_m),
            "duration_s_total": int(total_s),
        })




