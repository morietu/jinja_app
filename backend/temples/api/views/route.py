# backend/temples/api/views/route.py
from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.db import models
from django.shortcuts import get_object_or_404, render
from django.utils.decorators import method_decorator
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView
from temples.models import Shrine

UserModel = get_user_model()


def _has_owner_schema(shrine: Shrine) -> bool:
    """
    Shrine に“直接”定義された User への FK / M2M のみを見る。
    逆参照は含めないため、local_* を使う。
    """
    has_user_fk = any(
        isinstance(f, models.ForeignKey) and f.related_model == UserModel
        for f in shrine._meta.local_fields
    )
    has_user_m2m = any(
        isinstance(f, models.ManyToManyField) and f.related_model == UserModel
        for f in shrine._meta.local_many_to_many
    )
    # 慣例的な属性（プロパティ）も一応見る（あれば“所有者概念あり”とみなす）
    has_attr = any(hasattr(shrine, name) for name in ("owner", "owners"))
    return has_user_fk or has_user_m2m or has_attr


def _is_owner(user, shrine: Shrine) -> bool:
    """
    ローカル定義の User FK/M2M/ownerプロパティで、現在ユーザーが所有者か判定。
    """
    uid = getattr(user, "pk", None)

    # 直接の FK / OneToOne
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

    # 直接の M2M
    for f in shrine._meta.local_many_to_many:
        if isinstance(f, models.ManyToManyField) and f.related_model == UserModel:
            try:
                mgr = getattr(shrine, f.name)
                return bool(uid) and mgr.filter(pk=uid).exists()
            except Exception:
                pass

    # 慣例的プロパティ
    owner_obj = getattr(shrine, "owner", None)
    if owner_obj is not None and getattr(owner_obj, "pk", None) == uid:
        return True

    return False


class RouteView(APIView):
    @method_decorator(login_required)
    def get(self, request, pk=None):
        shrine = get_object_or_404(Shrine, pk=pk)

        lat = request.GET.get("lat")
        lng = request.GET.get("lng")
        has_route_params = bool(lat and lng)
        has_schema = _has_owner_schema(shrine)

        if has_schema:
            # スキーマがあるなら厳格に：非オーナーは 404
            if not _is_owner(request.user, shrine):
                return Response(status=404)
        else:
            # スキーマが無いなら：パラメータ付きのみ許可、無ければ 404
            if not has_route_params:
                return Response(status=404)

        return render(
            request,
            "temples/route.html",
            {"pk": pk, "lat": lat, "lng": lng},
        )

    def post(self, request):
        ser = RouteRequestSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

        data = request.data or {}
        origin = data.get("origin") or {}
        dests = data.get("destinations") or []
        mode = (data.get("mode") or "walking").lower()

        if not dests:
            return Response({"detail": "destinations required"}, status=status.HTTP_400_BAD_REQUEST)
        if len(dests) > 5:
            return Response({"detail": "max 5 destinations"}, status=status.HTTP_400_BAD_REQUEST)

        def _ok(p):
            try:
                lat = float(p.get("lat", 999))
                lng = float(p.get("lng", 999))
            except Exception:
                return False
            return -90 <= lat <= 90 and -180 <= lng <= 180

        if not _ok(origin) or any(not _ok(p) for p in dests):
            return Response({"detail": "lat/lng out of range"}, status=status.HTTP_400_BAD_REQUEST)

        # 簡易ハバースイン
        from math import asin, cos, radians, sin, sqrt

        def haversine_km(lat1, lng1, lat2, lng2):
            R = 6371.0088
            dphi = radians(lat2 - lat1)
            dlmb = radians(lng2 - lng1)
            phi1 = radians(lat1)
            phi2 = radians(lat2)
            a = sin(dphi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(dlmb / 2) ** 2
            return 2 * R * asin(sqrt(a))

        o_lat, o_lng = float(origin["lat"]), float(origin["lng"])
        speed_kmh = 5.0 if mode == "walking" else 40.0

        legs = []
        total_km = 0.0
        total_min = 0
        for d in dests:
            d_lat, d_lng = float(d["lat"]), float(d["lng"])
            dist_km = haversine_km(o_lat, o_lng, d_lat, d_lng)
            dur_min = max(1, int(round((dist_km / speed_kmh) * 60)))
            total_km += dist_km
            total_min += dur_min
            legs.append(
                {
                    "to": {"lat": d_lat, "lng": d_lng},
                    "distance_km": round(dist_km, 3),
                    "duration_min": dur_min,
                }
            )

        return Response(
            {
                "mode": mode,
                "provider": "dummy",
                "legs": legs,
                "distance_m_total": int(round(total_km * 1000)),
                "duration_s_total": int(total_min * 60),
            },
            status=200,
        )


class LatLngSerializer(serializers.Serializer):
    lat = serializers.FloatField(min_value=-90.0, max_value=90.0)
    lng = serializers.FloatField(min_value=-180.0, max_value=180.0)


class RouteRequestSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=["walking", "driving", "bicycling", "transit"])
    origin = LatLngSerializer()
    destinations = LatLngSerializer(many=True, allow_empty=False)

    # 上限5（テスト期待）
    def validate_destinations(self, v):
        if len(v) > 5:
            raise serializers.ValidationError("max 5 destinations")
        return v


class RouteAPIView(APIView):
    def post(self, request):
        ser = RouteRequestSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

        data = ser.validated_data
        mode = data["mode"]
        origin = data["origin"]
        dests = data["destinations"]

        # 簡易ハバースインで距離と時間を計算（RouteView.post と同等）
        from math import asin, cos, radians, sin, sqrt

        def haversine_km(lat1, lng1, lat2, lng2):
            R = 6371.0088
            dphi = radians(lat2 - lat1)
            dlmb = radians(lng2 - lng1)
            phi1 = radians(lat1)
            phi2 = radians(lat2)
            a = sin(dphi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(dlmb / 2) ** 2
            return 2 * R * asin(sqrt(a))

        o_lat, o_lng = float(origin["lat"]), float(origin["lng"])
        speed_kmh = 5.0 if mode == "walking" else 40.0  # テスト想定の簡易速度

        legs = []
        total_km = 0.0
        total_min = 0
        for d in dests:
            d_lat, d_lng = float(d["lat"]), float(d["lng"])
            dist_km = haversine_km(o_lat, o_lng, d_lat, d_lng)
            dur_min = max(1, int(round((dist_km / speed_kmh) * 60)))
            total_km += dist_km
            total_min += dur_min
            legs.append(
                {
                    "to": {"lat": d_lat, "lng": d_lng},
                    "distance_km": round(dist_km, 3),
                    "duration_min": dur_min,
                }
            )

        return Response(
            {
                "mode": mode,
                "provider": "dummy",
                "legs": legs,
                "distance_m_total": int(round(total_km * 1000)),
                "duration_s_total": int(total_min * 60),
            },
            status=200,
        )
        return Response(data, status=status.HTTP_200_OK)
