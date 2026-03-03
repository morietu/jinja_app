# backend/temples/api/views/search.py

import os
import logging
import time
import math


from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponse
from django.views.decorators.cache import cache_page
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle


from temples import services  # services.google_places を各所で利用
from temples.services.shrine_rules import is_shrine_like, prefer_explicit_jinja
from temples.api.serializers.places import (
    NearbySearchResponse,
    PlaceDetailResponse,
    PlacesSearchResponse,
    TextSearchResponse,
)
from temples.services import google_places as GP
from temples.services import places as PlacesSvc
from temples.services.places import places_photo, PlacesError

logger = logging.getLogger(__name__)


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> int:
    R = 6371000.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return int(R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


def _nearby_ident(request) -> str:
    """
    Nearby 用の識別子：
    - 認証済みユーザー: user:<pk>
    - 匿名ユーザー: REMOTE_ADDR（無ければ 'anon'）
    """
    if getattr(request, "user", None) and getattr(request.user, "is_authenticated", False):
        return f"user:{request.user.pk}"
    return request.META.get("REMOTE_ADDR") or "anon"


def _apply_places_nearby_throttle(request):
    """
    /api/places/nearby_search/ 用の手動スロットル。

    settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["places-nearby"]
    から「N/min」の N を読み取り、1分あたり N 回まで許可する。
    """
    rates = getattr(settings, "REST_FRAMEWORK", {}).get("DEFAULT_THROTTLE_RATES", {})
    rate = rates.get("places-nearby")
    if not rate:
        # レート設定が無い場合はスロットル無し
        return None

    try:
        num_str, per = rate.split("/", 1)
        limit = int(num_str)
    except Exception:
        # パースに失敗したら安全側にそこそこ小さい数にしておく
        limit = 30
        per = "min"

    # 単位は /min 前提で 60 秒窓を使う（/day などは現状想定しない）
    window = 60 if "min" in per else 60

    ident = _nearby_ident(request)
    cache_key = f"throttle:places-nearby:{ident}"
    now = time.time()

    history = cache.get(cache_key, [])
    # 窓外の古いリクエストを捨てる
    history = [ts for ts in history if ts > now - window]

    if len(history) >= limit:
        # DRF のメッセージに寄せた文言
        return Response(
            {"detail": "Request was throttled. Expected available in one minute."},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    # 現在のリクエストを追加して保存
    history.append(now)
    cache.set(cache_key, history, window)
    return None


# --- /api/places/search/ ---
@extend_schema(
    summary="Places: search",
    parameters=[
        OpenApiParameter(
            "q",
            OpenApiTypes.STR,
            OpenApiParameter.QUERY,
            required=True,
            description="検索クエリ（query も可）",
        ),
        OpenApiParameter("query", OpenApiTypes.STR, OpenApiParameter.QUERY, required=False),
        OpenApiParameter("lat", OpenApiTypes.FLOAT, OpenApiParameter.QUERY, required=False),
        OpenApiParameter("lng", OpenApiTypes.FLOAT, OpenApiParameter.QUERY, required=False),
        OpenApiParameter("radius", OpenApiTypes.INT, OpenApiParameter.QUERY, required=False),
    ],
    responses={200: PlacesSearchResponse},
    tags=["places"],
)

@api_view(["GET"])
@permission_classes([AllowAny])
@cache_page(60 * 5)
def search(request):
    # query / q 両対応（空は 400）
    q = (request.query_params.get("query") or request.query_params.get("q") or "").strip()
    if not q:
        return Response({"detail": "query is required"}, status=400)

    lat = request.query_params.get("lat")
    lng = request.query_params.get("lng")
    radius = request.query_params.get("radius")

    payload = {"q": q}
    if lat and lng:
        payload.update({"lat": lat, "lng": lng})
    if radius:
        payload["radius"] = radius

    try:
        # services.google_places に search() があれば使う。なければ text_search に委譲
        if hasattr(services.google_places, "search"):
            data = services.google_places.search(payload)
        else:
            # dict で渡すと lat/lng→location に正規化される
            data = GP.text_search(payload)
        return Response(data)
    except Exception:
        logger.exception("Exception in places.search")
        return Response(
            {"detail": "places.search failed due to an internal error"},
            status=status.HTTP_502_BAD_GATEWAY,
        )


# --- /api/places/text_search/ ---
def _text_search_response(request):
    # query / q 両対応（空は 400）
    q = (request.query_params.get("query") or request.query_params.get("q") or "").strip()
    if not q:
        return Response({"detail": "query is required"}, status=400)

    try:
        # lat/lng/radius が来ていたら一緒に回す（dict で渡すと wrapper が location へ変換）
        lat = request.query_params.get("lat")
        lng = request.query_params.get("lng")
        radius = request.query_params.get("radius")
        payload = {"q": q}
        if lat and lng:
            payload.update({"lat": lat, "lng": lng})
        if radius:
            payload["radius"] = radius

        data = services.google_places.text_search(payload)
        return Response(data)
    except Exception:
        logger.exception("Error in places.text_search")
        return Response(
            {"detail": "An internal error has occurred."},
            status=status.HTTP_502_BAD_GATEWAY,
        )


@extend_schema(
    summary="Places: text search",
    parameters=[
        OpenApiParameter(
            "q",
            OpenApiTypes.STR,
            OpenApiParameter.QUERY,
            required=True,
            description="検索クエリ（query も可）",
        ),
        OpenApiParameter("query", OpenApiTypes.STR, OpenApiParameter.QUERY, required=False),
        OpenApiParameter("lat", OpenApiTypes.FLOAT, OpenApiParameter.QUERY, required=False),
        OpenApiParameter("lng", OpenApiTypes.FLOAT, OpenApiParameter.QUERY, required=False),
        OpenApiParameter("radius", OpenApiTypes.INT, OpenApiParameter.QUERY, required=False),
    ],
    responses={200: TextSearchResponse},
    tags=["places"],
)

@api_view(["GET"])
@permission_classes([AllowAny])
@cache_page(60 * 5)
def text_search(request):
    return _text_search_response(request)


@extend_schema(exclude=True)
@api_view(["GET"])
@permission_classes([AllowAny])
@cache_page(60 * 5)
def text_search_legacy(request):
    return _text_search_response(request)


# --- /api/places/nearby_search/ ---
@extend_schema(
    operation_id="api_places_nearby_retrieve",
    summary="Places: nearby search",
    parameters=[
        OpenApiParameter("lat", OpenApiTypes.FLOAT, OpenApiParameter.QUERY, required=True),
        OpenApiParameter("lng", OpenApiTypes.FLOAT, OpenApiParameter.QUERY, required=True),
        OpenApiParameter("radius", OpenApiTypes.INT, OpenApiParameter.QUERY, required=False),
        OpenApiParameter("keyword", OpenApiTypes.STR, OpenApiParameter.QUERY, required=False),
        OpenApiParameter("type", OpenApiTypes.STR, OpenApiParameter.QUERY, required=False),
        OpenApiParameter("limit", OpenApiTypes.INT, OpenApiParameter.QUERY, required=False),
    ],
    responses={200: NearbySearchResponse},
    tags=["places"],
)
@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([ScopedRateThrottle])
def nearby_search(request):
    throttled = _apply_places_nearby_throttle(request)
    if throttled is not None:
        return throttled

    try:
        lat = float(request.query_params.get("lat"))
        lng = float(request.query_params.get("lng"))
        radius = int(request.query_params.get("radius", 1000))
    except (TypeError, ValueError):
        return Response({"detail": "lat,lng は float、radius は int で指定してください"}, status=400)

    limit = int(request.query_params.get("limit", 10))
    keyword = request.query_params.get("keyword")
    place_type = request.query_params.get("type")

    if not keyword and not place_type:
        keyword = "神社"

    shrine_mode = keyword in (None, "神社")
    if shrine_mode:
        place_type = None

    use_new = (os.getenv("PLACES_API_NEW") == "1") and shrine_mode
    data = None

    # ① NEW を試す（失敗してもOK）
    if use_new:
        try:
            data = GP.nearby_search_new(lat=lat, lng=lng, radius=radius, limit=limit, keyword=keyword)
        except Exception as e:
            logger.warning("nearby_search_new failed; fallback to legacy attempts: %s", repr(e))
            data = None

    # ② data が無ければ legacy attempts
    if data is None:
        def opt_args():
            d = {}
            if keyword:
                d["keyword"] = keyword
            if place_type:
                d["type"] = place_type
            return d

        attempts = [
            dict(location=(lat, lng), radius=radius, **opt_args()),
            dict(location=f"{lat},{lng}", radius=radius, **opt_args()),
            dict(location=(lat, lng), radius=radius),
            dict(location=f"{lat},{lng}", radius=radius),
            dict(lat=lat, lng=lng, radius=radius, **opt_args()),
            dict(lat=lat, lng=lng, radius=radius),
        ]

        first_err = None

        for kwargs in attempts:
            try:
                data = GP.nearby_search(**kwargs)
                break

            except TypeError as e:
                first_err = first_err or e
                logger.info(
                    "places.nearby_search TypeError (attempt skipped): %s kwargs=%s",
                    repr(e),
                    kwargs,
                )
                continue

            except RuntimeError as e:
                msg = str(e)
                logger.exception(
                    "places.nearby_search RuntimeError: msg=%s kwargs=%s",
                    msg,
                    kwargs,
                )

                if "INVALID_REQUEST" in msg:
                    first_err = first_err or e
                    continue

                first_err = first_err or e
                return Response(
                    {"detail": "places.nearby_search は内部エラーのため失敗しました"},
                    status=status.HTTP_502_BAD_GATEWAY,
                )

            except Exception as e:
                first_err = first_err or e
                logger.warning(
                    "places.nearby_search Exception (attempt continue): %s kwargs=%s",
                    repr(e),
                    kwargs,
                )
                continue

        if data is None:
            logger.exception(
                "places.nearby_search のフォールバックを全て失敗しました: first_err=%s",
                repr(first_err),
            )
            return Response(
                {"detail": "places.nearby_search は内部エラーのため失敗しました"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

    # ③ サーバ側フィルタ
    results = data.get("results", [])

    if keyword in (None, "神社"):
        results = [r for r in results if is_shrine_like(r)]
        prefer = [r for r in results if prefer_explicit_jinja(r)]
        results = prefer or results
    else:
        place_type_req = request.query_params.get("type")
        if place_type_req:
            results = [r for r in results if place_type_req in (r.get("types") or [])]

    # ④ distance_m 付与
    out = []
    for r in results:
        if r.get("distance_m") is None:
            try:
                rlat = float(r.get("lat"))
                rlng = float(r.get("lng"))
                r["distance_m"] = _haversine_m(lat, lng, rlat, rlng)
            except Exception:
                r["distance_m"] = None
        out.append(r)

    out.sort(key=lambda x: x["distance_m"] if isinstance(x.get("distance_m"), int) else 10**12)
    data["results"] = out
    return Response(data)

# レガシー入口（/api/places/nearby_search/）
nearby_search.throttle_scope = "places-nearby"


@extend_schema(exclude=True)
@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([ScopedRateThrottle])
def nearby_search_legacy(request, *args, **kwargs):
    """/api/places/nearby_search/ のレガシー入口（DRF Request→Django HttpRequest）"""
    try:
        from rest_framework.request import Request as DRFRequest
    except Exception:
        DRFRequest = None
    dj_req = (
        getattr(request, "_request", None)
        if (DRFRequest and isinstance(request, DRFRequest))
        else request
    )
    return nearby_search(dj_req, *args, **kwargs)


nearby_search_legacy.throttle_scope = "places-nearby"


# --- /api/places/photo/ ---
@extend_schema(
    summary="Places: photo (binary)",
    parameters=[
        OpenApiParameter(
            "photo_reference", OpenApiTypes.STR, OpenApiParameter.QUERY, required=True
        ),
        OpenApiParameter("maxwidth", OpenApiTypes.INT, OpenApiParameter.QUERY, required=False),
    ],
    responses={200: OpenApiTypes.BINARY},
    tags=["places"],
)
@api_view(["GET"])
@permission_classes([AllowAny])
def photo(request):
    """
    /api/places/photo/?photo_reference=...&maxwidth=...
    services.google_places.photo は (bytes, content_type) を返す契約
    """
    ref = request.query_params.get("photo_reference")
    if not ref:
        return Response({"detail": "photo_reference is required"}, status=400)
    maxwidth = request.query_params.get("maxwidth")
    try:
        mw = int(maxwidth) if maxwidth is not None else 800
    except Exception:
        mw = 800

    try:
        blob, content_type, _ttl = places_photo(ref, maxwidth=mw)
    except PlacesError as e:
        # status が 500 でも、ここは upstream 依存なので 502 に寄せる
        logger.info("places.photo failed: %s", str(e))
        return Response(
            {"detail": "places.photo failed"},
            status=getattr(e, "status", 502) or 502,
        )

    resp = HttpResponse(blob, content_type=content_type)
    resp["Cache-Control"] = f"public, max-age={_ttl}"
    return resp

    

def _detail_impl(place_id: str):
    gp = services.google_places
    try:
        data = gp.detail(place_id=place_id) if hasattr(gp, "detail") else gp.details(place_id=place_id)
    except Exception:
        logger.exception("places.detail で例外が発生しました")
        return Response(
            {"detail": "places.detail は内部エラーのため失敗しました"},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    src = data.get("result") or data.get("place") or data or {}

    out = {
        "place_id": src.get("place_id") or place_id,
        "name": src.get("name"),
        "address": src.get("formatted_address") or src.get("vicinity"),
        "rating": src.get("rating"),
        "user_ratings_total": src.get("user_ratings_total"),
        "types": src.get("types") or [],
    }

    loc = ((src.get("geometry") or {}).get("location")) or {}
    if "lat" in loc and "lng" in loc:
        out["location"] = {"lat": loc["lat"], "lng": loc["lng"]}

    photos = src.get("photos") or []
    if photos and isinstance(photos, list):
        ref = photos[0].get("photo_reference")
        if ref:
            out["photo_reference"] = ref

    return Response(out)

# --- /api/places/<id>/（detail by path） ---
@extend_schema(
    operation_id="api_places_detail_by_id",
    summary="Places: detail",
    parameters=[OpenApiParameter("id", OpenApiTypes.STR, OpenApiParameter.PATH, required=True)],
    responses={200: PlaceDetailResponse},
    tags=["places"],
)
@api_view(["GET"])
@permission_classes([AllowAny])
def detail(request, id: str):
    pid = (id or "").strip()
    if not pid:
        return Response({"detail": "place_id is required"}, status=400)
    return _detail_impl(pid)

# --- /api/places/detail/?place_id=...（detail by query） ---
@extend_schema(
    operation_id="api_places_detail_by_query",
    summary="Places: detail (query version)",
    parameters=[OpenApiParameter("place_id", OpenApiTypes.STR, OpenApiParameter.QUERY, required=True)],
    responses={200: PlaceDetailResponse},
    tags=["places"],
)
@api_view(["GET"])
@permission_classes([AllowAny])
def detail_query(request):
    pid = (request.query_params.get("place_id") or "").strip()
    if not pid:
        return Response({"detail": "place_id is required"}, status=400)
    return _detail_impl(pid)


@extend_schema(exclude=True)
@api_view(["GET"])
@permission_classes([AllowAny])
def detail_short(request, id: str):
    pid = (id or "").strip()
    if not pid:
        return Response({"detail": "place_id is required"}, status=400)
    return _detail_impl(pid)


@extend_schema(
    summary="Places: find (lite)",
    request=OpenApiTypes.OBJECT,
    responses={200: OpenApiTypes.OBJECT},
    tags=["places"],
)
@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def places_find(request):
    # GET/POST 両方で payload 揺れを吸収
    if request.method == "GET":
        q = (request.query_params.get("input") or request.query_params.get("q") or request.query_params.get("query") or "").strip()
        lat = request.query_params.get("lat")
        lng = request.query_params.get("lng")
        radius = request.query_params.get("radius")
    else:
        q = (request.data.get("input") or request.data.get("q") or request.data.get("query") or "").strip()
        lat = request.data.get("lat")
        lng = request.data.get("lng")
        radius = request.data.get("radius")

    if not q:
        return Response({"detail": "input is required"}, status=400)

    locationbias = None
    try:
        if lat is not None and lng is not None and radius is not None:
            locationbias = f"circle:{int(radius)}@{float(lat)},{float(lng)}"
    except Exception:
        locationbias = None

    fields = (
        "place_id,formatted_address,geometry,photos,name,"
        "rating,user_ratings_total,types,opening_hours,icon"
    )

    try:
        data = PlacesSvc.find_place(
            input=q,
            language="ja",
            inputtype="textquery",
            locationbias=locationbias,
            fields=fields,
        )

        # contract: results を必ず返す
        if "results" in data:
            return Response(data)
        if "candidates" in data:
            return Response({"results": data.get("candidates") or [], "status": data.get("status")})
        # どちらでもなければ空で返す（壊さない）
        return Response({"results": [], "status": data.get("status")})

    except Exception:
        logger.exception("places.find failed")
        return Response(
            {"detail": "places.find は内部エラーのため失敗しました"},
            status=status.HTTP_502_BAD_GATEWAY,
        )
