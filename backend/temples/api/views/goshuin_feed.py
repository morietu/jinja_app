# backend/temples/api/views/goshuin_feed.py

from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny
from temples.models import Goshuin
from temples.serializers.routes import GoshuinSerializer

class PublicGoshuinFeedView(ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = GoshuinSerializer

    def get_queryset(self):
        return (
            Goshuin.objects
            .filter(is_public=True)
            .filter(images__isnull=False)     # ✅ 画像があるものだけ
            .select_related("shrine")
            .prefetch_related("images")
            .distinct()
            .order_by("-created_at", "-id")
        )

