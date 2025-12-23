from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny

from .models import Goshuin
from .serializers import GoshuinSerializer

User = get_user_model()

class PublicGoshuinListView(ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = GoshuinSerializer

    def get_queryset(self):
        username = self.kwargs["username"]
        user = get_object_or_404(User, username=username)  # ★ここでユーザー無し=404
        return Goshuin.objects.filter(user=user, is_public=True).order_by("-id")
