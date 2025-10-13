# backend/temples/api/views/route.py
from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.db import models
from django.shortcuts import get_object_or_404, render
from django.utils.decorators import method_decorator
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from temples.models import Shrine
from temples.route_service import Point, build_route

# ✅ 既存の“正規シリアライザ”を使う（再定義しない）
from temples.serializers.routes import RouteRequestSerializer, RouteResponseSerializer

UserModel = get_user_model()


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


class RouteView(APIView):
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

    def post(self, request):
        # ✅ 既存の正規シリアライザを使用
        ser = RouteRequestSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

        data = ser.validated_data
        mode = data["mode"]  # "walking" / "driving"
        origin = Point(lat=float(data["origin"]["lat"]), lng=float(data["origin"]["lng"]))
        dests = [Point(lat=float(d["lat"]), lng=float(d["lng"])) for d in data["destinations"]]

        # ✅ ここで Adapter（ORS/OSRM/Dummy）に委譲
        result = build_route(mode, origin, dests)

        # ✅ 出力も正規シリアライザで整形
        out = RouteResponseSerializer(result).data
        return Response(out, status=200)


# ✅ API 用の別エンドポイントが必要なら、同様に build_route に寄せる
class RouteAPIView(APIView):
    def post(self, request):
        ser = RouteRequestSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

        data = ser.validated_data
        mode = data["mode"]
        origin = Point(lat=float(data["origin"]["lat"]), lng=float(data["origin"]["lng"]))
        dests = [Point(lat=float(d["lat"]), lng=float(d["lng"])) for d in data["destinations"]]

        result = build_route(mode, origin, dests)
        out = RouteResponseSerializer(result).data
        return Response(out, status=200)
