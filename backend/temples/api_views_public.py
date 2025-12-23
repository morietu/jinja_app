from django.contrib.auth import get_user_model
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny
from rest_framework.pagination import LimitOffsetPagination

from .models import Goshuin
from .serializers import GoshuinSerializer

User = get_user_model()


class PublicGoshuinPagination(LimitOffsetPagination):
    default_limit = 12
    max_limit = 50


class PublicGoshuinListView(ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = GoshuinSerializer
    pagination_class = PublicGoshuinPagination

    def get_queryset(self):
        username = self.kwargs["username"]
        return (
            Goshuin.objects
            .filter(user__username=username, is_public=True)
            .order_by("-id")
        )
