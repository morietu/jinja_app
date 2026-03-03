from rest_framework import generics
from rest_framework.permissions import AllowAny

from temples.models import Shrine  # ←実パスに合わせる
from temples.api.serializers.shrine_public import ShrinePublicSerializer

class PublicShrineDetailView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = ShrinePublicSerializer
    queryset = Shrine.objects.all()
    lookup_field = "pk"
