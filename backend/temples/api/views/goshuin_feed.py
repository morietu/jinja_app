# backend/temples/api/views/goshuin_feed.py

from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny
from temples.models import Goshuin
from temples.serializers.routes import GoshuinSerializer

class PublicGoshuinFeedView(ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = GoshuinSerializer

    def get_queryset(self):
        qs = (
            Goshuin.objects
            .filter(is_public=True)
            .filter(images__isnull=False)
            .select_related("shrine")
            .prefetch_related("images")
            .distinct()
            .order_by("-created_at", "-id")
        )
        shrine = self.request.query_params.get("shrine")
        if shrine and str(shrine).isdigit():
            qs = qs.filter(shrine_id=int(shrine))
        return qs
