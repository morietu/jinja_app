# temples/api/views/search.py
from django.http import HttpResponse
from django.views.decorators.cache import cache_page
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

# これが抜けていると NameError になります
from temples import services
from temples.api.throttles import PlacesNearbyThrottle


def _nearby_ident(request) -> str:
    # 認証済みなら user:<pk>、匿名は REMOTE_ADDR（無ければ固定 'anon'）
    if getattr(request, "user", None) and getattr(request.user, "is_authenticated", False):
        return f"user:{request.user.pk}"
    return request.META.get("REMOTE_ADDR") or "anon"


# --- /api/places/search/ ---
@api_view(["GET"])
@permission_classes([AllowAny])
@cache_page(60 * 5)  # 5分キャッシュ（テストは即時2回叩くので十分）
def search(request):

    q = request.query_params.get("q")
    lat = request.query_params.get("lat")
    lng = request.query_params.get("lng")

    gp = services.google_places
    if hasattr(gp, "search"):
        data = gp.search({"q": q, "lat": lat, "lng": lng})
    else:
        # フォールバック：text_search で代用（lat/lng は無視）
        data = gp.text_search({"q": q, "lat": lat, "lng": lng})
    return Response(data)


# --- /api/places/text_search/ ---
@api_view(["GET"])
@permission_classes([AllowAny])
@cache_page(60 * 5)
def text_search(request):
    q = request.query_params.get("q") or ""
    try:
        # ← 引数名は query
        data = services.google_places.text_search(query=q)
        return Response(data)
    except Exception as e:
        return Response(
            {"detail": f"places.text_search failed: {e!s}"}, status=status.HTTP_502_BAD_GATEWAY
        )


# --- /api/places/nearby_search/ ---


@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([PlacesNearbyThrottle])
def nearby_search(request):
    try:
        lat = float(request.query_params.get("lat"))
        lng = float(request.query_params.get("lng"))
        radius = int(request.query_params.get("radius", 1000))
    except (TypeError, ValueError):
        return Response(
            {"detail": "lat,lng は float、radius は int で指定してください"}, status=400
        )

    keyword = request.query_params.get("keyword")
    place_type = request.query_params.get("type")

    # ① 両方未指定→デフォルトで神社検索
    if not keyword and not place_type:
        keyword = "神社"

    # 「神社モード」では Google に type を渡さない（混入抑制）
    shrine_mode = keyword == "神社"
    if shrine_mode:
        place_type = None

    # 可変引数（存在するときだけ渡す）
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
    data = None
    for kwargs in attempts:
        try:
            data = services.google_places.nearby_search(**kwargs)
            break
        except TypeError as e:
            if first_err is None:
                first_err = e
            continue
        except RuntimeError as e:
            msg = str(e)
            if "INVALID_REQUEST" in msg:
                if first_err is None:
                    first_err = e
                continue
            return Response(
                {"detail": f"places.nearby_search failed: {msg}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except Exception as e:
            if first_err is None:
                first_err = e
            continue
    else:
        return Response(
            {"detail": f"places.nearby_search failed after fallbacks: {first_err!s}"}, status=502
        )

    # ② サーバ側フィルタ
    results = data.get("results", [])

    # 神社判定：名前/住所に「神社」 or types に shinto_shrine
    def is_shrine(r):
        name = r.get("name") or ""
        addr = r.get("address") or ""
        types = set(r.get("types") or [])
        if "神社" in (name + addr):
            return True
        if "shinto_shrine" in types:
            return True
        return False

    if shrine_mode:
        # 神社だけ残す
        results = [r for r in results if is_shrine(r)]
        # さらに“神社”を含むものを優先（無ければ全件そのまま）
        prefer = [r for r in results if "神社" in ((r.get("name", "") + r.get("address", "")))]
        results = prefer or results
    else:
        # type パラメータが明示されているときは厳格に types で絞る
        place_type_req = request.query_params.get("type")
        if place_type_req:
            results = [r for r in results if place_type_req in (r.get("types") or [])]

    data["results"] = results
    return Response(data)


nearby_search.throttle_scope = "places-nearby"


# --- /api/places/photo/ ---
@api_view(["GET"])
@permission_classes([AllowAny])
@cache_page(60 * 60)  # 1時間キャッシュ（実運用イメージ）
def photo(request):
    """
    /api/places/photo/?photo_reference=...&maxwidth=...
    services.google_places.photo は (bytes, content_type) を返す契約
    """
    ref = request.query_params.get("photo_reference")
    maxwidth = request.query_params.get("maxwidth")
    blob, content_type = services.google_places.photo(photo_reference=ref, maxwidth=maxwidth)
    resp = HttpResponse(blob, content_type=content_type)
    # テストが見るのはこのヘッダ
    resp["Cache-Control"] = "public, max-age=3600"
    return resp


# temples/api/views/search.py


@api_view(["GET"])
@permission_classes([AllowAny])
def detail(request, place_id: str):
    gp = services.google_places
    try:
        data = (
            gp.detail(place_id=place_id) if hasattr(gp, "detail") else gp.details(place_id=place_id)
        )
    except Exception as e:
        return Response(
            {"detail": f"places.detail failed: {e!s}"}, status=status.HTTP_502_BAD_GATEWAY
        )

    src = data.get("result") or data.get("place") or data or {}

    # 必須フィールドを整形
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

    # 互換のため photo_reference もあれば1枚だけ拾う
    photos = src.get("photos") or []
    if photos and isinstance(photos, list):
        ref = photos[0].get("photo_reference")
        if ref:
            out["photo_reference"] = ref

    return Response(out)
