# backend/temples/views/places.py
from typing import Optional
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework import status
from django.http import HttpResponse

from temples import services  # services.__init__ で places_* をエクスポートしている想定
from temples.services.places import PlacesError  # 例外をHTTPへ正規化

# ---------- helpers ----------
def _to_bool(v: Optional[str]) -> bool:
    if v is None:
        return False
    return str(v).strip().lower() in {"1", "true", "yes", "on"}

def _to_float(v: Optional[str]) -> Optional[float]:
    if v in (None, ""):
        return None
    try:
        return float(v)
    except ValueError:
        return None

def _to_int(v: Optional[str]) -> Optional[int]:
    if v in (None, ""):
        return None
    try:
        return int(v)
    except ValueError:
        return None


class DualScopedThrottleView(APIView):
    """
    places_burst + places_sustain の二段スロットルを同時適用
    settings.REST_FRAMEWORK.DEFAULT_THROTTLE_RATES のキーと一致している必要あり
    """
    throttle_classes = [ScopedRateThrottle, ScopedRateThrottle]
    throttle_scope = "places_burst"

    def get_throttles(self):
        # 1つ目（バースト）
        self.throttle_scope = "places_burst"
        t1 = super().get_throttles()
        # 2つ目（持続）
        self.throttle_scope = "places_sustain"
        t2 = super().get_throttles()
        # 後続処理用に戻す
        self.throttle_scope = "places_burst"
        return t1 + t2


class PlacesTextSearchView(DualScopedThrottleView):
    def get(self, request):
        try:
            params = {
                "q": request.query_params.get("q"),
                "lat": _to_float(request.query_params.get("lat")),
                "lng": _to_float(request.query_params.get("lng")),
                "radius": _to_int(request.query_params.get("radius")),
                "type": request.query_params.get("type"),
                "opennow": _to_bool(request.query_params.get("opennow")),
                "pagetoken": request.query_params.get("pagetoken"),
                "language": request.query_params.get("language"),
            }
            data = services.places_text_search(params)
            return Response(data, status=status.HTTP_200_OK)
        except PlacesError as e:
            return Response({"detail": str(e)}, status=e.status or 500)


class PlacesNearbySearchView(DualScopedThrottleView):
    def get(self, request):
        try:
            params = {
                "lat": _to_float(request.query_params.get("lat")),
                "lng": _to_float(request.query_params.get("lng")),
                "radius": _to_int(request.query_params.get("radius")),
                "keyword": request.query_params.get("keyword"),
                "type": request.query_params.get("type"),
                "opennow": _to_bool(request.query_params.get("opennow")),
                "pagetoken": request.query_params.get("pagetoken"),
                "language": request.query_params.get("language"),
            }

            # pagetoken が無い場合は lat/lng/radius を最低限チェック
            if not params["pagetoken"]:
                if params["lat"] is None or params["lng"] is None:
                    return Response(
                        {"detail": "lat/lng は必須です（pagetoken 指定時を除く）"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if params["radius"] is None:
                    params["radius"] = 1500  # 既定

            data = services.places_nearby_search(params)
            return Response(data, status=status.HTTP_200_OK)
        except PlacesError as e:
            return Response({"detail": str(e)}, status=e.status or 500)


class PlacesDetailsView(DualScopedThrottleView):
    def get(self, request, place_id: str):
        try:
            params = {
                "language": request.query_params.get("language"),
                "fields": request.query_params.get("fields"),
            }
            data = services.places_details(place_id, params)
            return Response(data, status=status.HTTP_200_OK)
        except PlacesError as e:
            return Response({"detail": str(e)}, status=e.status or 500)


class PlacesPhotoProxyView(DualScopedThrottleView):
    def get(self, request):
        try:
            ref = request.query_params.get("photo_reference")
            if not ref:
                return Response({"detail": "photo_reference は必須です"}, status=status.HTTP_400_BAD_REQUEST)

            maxwidth = _to_int(request.query_params.get("maxwidth")) or 800
            content, content_type, max_age = services.places_photo(ref, maxwidth)

            resp = HttpResponse(content, content_type=content_type)
            # Cache-Control（フロント/CDN向けヒント）
            resp["Cache-Control"] = f"public, max-age={max_age}"
            return resp
        except PlacesError as e:
            return Response({"detail": str(e)}, status=e.status or 500)
