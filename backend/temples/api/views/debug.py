# backend/temples/api/views/debug.py
import os

from django.conf import settings
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny

from temples.models import GoshuinImage


@api_view(["GET"])
@permission_classes([AllowAny])
def media_debug(request):
    """
    本番コンテナの MEDIA_ROOT と、最新 GoshuinImage のファイル状態を確認するための一時エンドポイント
    """
    data = {
        "MEDIA_ROOT": str(settings.MEDIA_ROOT),
        "MEDIA_URL": settings.MEDIA_URL,
        "DEBUG": settings.DEBUG,
    }

    img = GoshuinImage.objects.order_by("-id").first()
    if not img or not img.image:
        data["has_image"] = False
    else:
        data["has_image"] = True
        try:
            name = img.image.name
            url = img.image.url
            path = img.image.path
            exists = os.path.exists(path)
        except Exception as e:
            name = getattr(img.image, "name", None)
            url = getattr(img.image, "url", None)
            path = None
            exists = False
            data["error"] = str(e)

        data.update(
            {
                "image_name": name,   # 例: "goshuin/IMG_1058_WVtFwuY.JPG"
                "image_url": url,     # 例: "/media/goshuin/IMG_1058_WVtFwuY.JPG"
                "image_path": path,   # 例: "/opt/render/project/src/backend/media/goshuin/..."
                "image_exists": exists,
            }
        )

    return JsonResponse(data)
