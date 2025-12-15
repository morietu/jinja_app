# backend/temples/api/views/debug.py
import os

from django.conf import settings
from django.urls import resolve, Resolver404
from django.db.models import Sum, Count
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from temples.models import GoshuinImage
from drf_spectacular.utils import extend_schema

from django.core.files.storage import default_storage


@extend_schema(exclude=True)
@api_view(["GET"])
@permission_classes([AllowAny])
def media_debug(request):
    """
    本番コンテナの MEDIA_ROOT と、最新 GoshuinImage のファイル状態 + URL解決結果を確認するための一時エンドポイント
    """
    data = {
        "MEDIA_ROOT": str(settings.MEDIA_ROOT),
        "MEDIA_URL": settings.MEDIA_URL,
        "DEBUG": settings.DEBUG,
    }

    img = GoshuinImage.objects.order_by("-id").first()
    if not img or not img.image:
        data["has_image"] = False
        return JsonResponse(data)

    # ここから「画像あり」のケース
    data["has_image"] = True

    name = None
    url = None
    path = None
    exists = False
    error = None

    try:
        name = img.image.name      # 例: "goshuin/IMG_1058.JPG"
        url = img.image.url       # 例: "/media/goshuin/IMG_1058.JPG"
        path = img.image.path     # 例: "/opt/render/project/src/backend/media/goshuin/IMG_1058.JPG"
        exists = os.path.exists(path)
    except Exception as e:
        error = str(e)

    data.update(
        {
            "image_name": name,
            "image_url": url,
            "image_path": path,
            "image_exists": exists,
        }
    )
    if error:
        data["error"] = error

    # ---- ここから URL resolver の情報を追加 ----
    resolved = None
    resolved_media_plus_name = None

    # 1) image_url をそのまま resolve してみる（"/media/..." 想定）
    if url:
        try:
            m = resolve(url)
            resolved = f"{m.func} kwargs={m.kwargs}"
        except Resolver404:
            resolved = "Resolver404"

    # 2) 念のため MEDIA_URL + image_name でも試す
    if name:
        # MEDIA_URL は "/media/" 想定なので、前後のスラッシュを軽く正規化
        media_url = settings.MEDIA_URL or "/media/"
        media_url = "/" + media_url.lstrip("/")
        if not media_url.endswith("/"):
            media_url += "/"

        candidate = media_url + name  # 例: "/media/goshuin/IMG_1058.JPG"
        try:
            m2 = resolve(candidate)
            resolved_media_plus_name = f"{m2.func} kwargs={m2.kwargs}"
        except Resolver404:
            resolved_media_plus_name = "Resolver404"

    data["resolved_image_url"] = resolved
    data["resolved_media_plus_name"] = resolved_media_plus_name
    # ---- ここまで ----

    return JsonResponse(data)

@extend_schema(exclude=True)
@api_view(["GET"])
@permission_classes([AllowAny])
def storage_debug(request):
    qs = GoshuinImage.objects.all()
    return JsonResponse({
        "storage_class": default_storage.__class__.__name__,
        "storage_module": default_storage.__class__.__module__,
        "count": qs.count(),
        "sum_size_bytes": int(qs.aggregate(s=Sum("size_bytes"))["s"] or 0),
        "zero_count": qs.filter(size_bytes=0).count(),
        "null_count": qs.filter(size_bytes__isnull=True).count(),
    })
