# backend/temples/api/views/route.py
import os

import requests
from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.db import models
from django.shortcuts import get_object_or_404, render
from django.utils.decorators import method_decorator
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from temples.models import Shrine
from temples.route_service import Point, build_route
from temples.serializers.routes import (
    RouteRequestSerializer,
    RouteResponseSerializer,
)

UserModel = get_user_model()

# .env(.local) で OSRM_BASE_URL を上書き（例: http://127.0.0.1:5001）
OSRM_BASE = os.getenv("OSRM_BASE_URL", "http://127.0.0.1:5000")


def _has_owner_schema(shrine: Shrine) -> bool:
    has_user_fk = any(
        isinstance(f, models.ForeignKey) and f.related_model == UserModel
        for f in shrine._meta.local_fields
    )
    has_user_m2m = any(
        isinstance(f, models.ManyToManyField) and f.related_model == UserModel
        for f in shrine._meta.local_many_to_many
    )
    has_attr = any(hasattr(shrine, name) for name in ("owner", "owners"))
    return has_user_fk or has_user_m2m or has_attr


def _is_owner(user, shrine: Shrine) -> bool:
    uid = getattr(user, "pk", None)

    for f in shrine._meta.local_fields:
        if (
            isinstance(f, (models.ForeignKey, models.OneToOneField))
            and f.related_model == UserModel
        ):
            owner_id = getattr(shrine, getattr(f, "attname", f.name), None)
            if owner_id is None:
                rel = getattr(shrine, f.name, None)
                owner_id = getattr(rel, "pk", None)
            return owner_id == uid

    for f in shrine._meta.local_many_to_many:
        if isinstance(f, models.ManyToManyField) and f.related_model == UserModel:
            try:
                mgr = getattr(shrine, f.name)
                return bool(uid) and mgr.filter(pk=uid).exists()
            except Exception:
                pass

    owner_obj = getattr(shrine, "owner", None)
    if owner_obj is not None and getattr(owner_obj, "pk", None) == uid:
        return True

    return False


class RouteAPIView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "routes"

    @extend_schema(
        summary="Compute route (OSRM)",
        description=(
            "OSRMで2点間のルートを返す。"
            "distance(m) / duration(s) / geometry(GeoJSON LineString)。"
        ),
        tags=["routes"],
        parameters=[
            OpenApiParameter("from_lat", OpenApiTypes.FLOAT, OpenApiParameter.QUERY, required=True),
            OpenApiParameter("from_lng", OpenApiTypes.FLOAT, OpenApiParameter.QUERY, required=True),
            OpenApiParameter("to_lat", OpenApiTypes.FLOAT, OpenApiParameter.QUERY, required=True),
            OpenApiParameter("to_lng", OpenApiTypes.FLOAT, OpenApiParameter.QUERY, required=True),
            OpenApiParameter(
                "mode",
                OpenApiTypes.STR,
                OpenApiParameter.QUERY,
                required=False,
                description="driving|car（car.luaのみならdriving固定でも可）",
            ),
        ],
        responses={200: RouteResponseSerializer},
    )
    def get(self, request):
        try:
            lat1 = float(request.GET.get("from_lat"))
            lng1 = float(request.GET.get("from_lng"))
            lat2 = float(request.GET.get("to_lat"))
            lng2 = float(request.GET.get("to_lng"))
        except (TypeError, ValueError):
            return Response(
                {"detail": "from_lat/from_lng/to_lat/to_lng are required floats."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not (
            -90 <= lat1 <= 90 and -180 <= lng1 <= 180 and -90 <= lat2 <= 90 and -180 <= lng2 <= 180
        ):
            return Response(
                {"detail": "coordinates out of range."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile = (request.GET.get("mode") or "driving").lower()
        if profile not in {"driving", "car"}:
            profile = "driving"

        url = f"{OSRM_BASE}/route/v1/{profile}/{lng1},{lat1};{lng2},{lat2}"
        params = {"overview": "full", "geometries": "geojson"}
        try:
            r = requests.get(url, params=params, timeout=6)
            data = r.json()
        except Exception as e:
            return Response(
                {"detail": f"OSRM error: {e}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        if not data or data.get("code") != "Ok" or not data.get("routes"):
            return Response(
                {"detail": "No route found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        route = data["routes"][0]
        return Response(
            {
                "distance_m": route["distance"],
                "duration_s": route["duration"],
                "geometry": route["geometry"],  # GeoJSON LineString
            },
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        summary="Compute multi-stop route",
        description="（内部サービス）複数目的地向け。",
        tags=["routes"],
        request=RouteRequestSerializer,
        responses={200: RouteResponseSerializer},
    )
    def post(self, request):
        ser = RouteRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        mode = data["mode"]  # "walking" / "driving" など
        origin = Point(lat=float(data["origin"]["lat"]), lng=float(data["origin"]["lng"]))
        dests = [Point(lat=float(d["lat"]), lng=float(d["lng"])) for d in data["destinations"]]

        result = build_route(mode, origin, dests)
        out = RouteResponseSerializer(result).data
        return Response(out, status=status.HTTP_200_OK)


class RouteLegacyAPIView(RouteAPIView):
    schema = None


class RouteView(APIView):
    @extend_schema(
        summary="Route page for a shrine",
        parameters=[
            OpenApiParameter("pk", OpenApiTypes.INT, OpenApiParameter.PATH, required=True),
            OpenApiParameter("lat", OpenApiTypes.FLOAT, OpenApiParameter.QUERY, required=False),
            OpenApiParameter("lng", OpenApiTypes.FLOAT, OpenApiParameter.QUERY, required=False),
        ],
        responses={200: None},
        tags=["routes"],
    )
    @method_decorator(login_required)
    def get(self, request, pk=None):
        shrine = get_object_or_404(Shrine, pk=pk)

        lat = request.GET.get("lat")
        lng = request.GET.get("lng")
        has_route_params = bool(lat and lng)
        has_schema = _has_owner_schema(shrine)

        if has_schema:
            if not _is_owner(request.user, shrine):
                return Response(status=404)
        else:
            if not has_route_params:
                return Response(status=404)

        return render(
            request,
            "temples/route.html",
            {"pk": pk, "lat": lat, "lng": lng},
        )


@extend_schema(exclude=True)
@api_view(["POST"])
@permission_classes([AllowAny])
def route_legacy(request, *args, **kwargs):
    """
    /api/route/ → /api/routes/ へ委譲（実装形態の差異に耐える）
    - 関数ビュー `route` が globals にあればそれを優先
    - ダメなら APIView へフォールバック
    - さらにダメなら CBV (RouteView) へ
    """
    # 1) もし関数ビュー `route` があるなら、それは @api_view デコレータ想定なので
    #    DRF Request のまま渡してよい
    fn = globals().get("route")
    if callable(fn):
        try:
            return fn(request, *args, **kwargs)
        except Exception:
            pass  # フォールバックへ

    # 2) APIView / 汎用 CBV は Django HttpRequest を要求するので、_request を取り出す
    raw_request = getattr(request, "_request", request)

    try:
        return RouteAPIView.as_view()(raw_request, *args, **kwargs)
    except Exception:
        return RouteView.as_view()(raw_request, *args, **kwargs)
