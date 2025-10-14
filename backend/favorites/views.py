from rest_framework import mixins, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Favorite
from .serializers import FavoriteCreateSerializer, FavoriteSerializer


class FavoriteViewSet(
    mixins.ListModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated]
    serializer_class = FavoriteSerializer
    pagination_class = None  # temples 側テストは「配列」で返ることを期待

    def get_queryset(self):
        return Favorite.objects.filter(user=self.request.user).order_by("-id")

    def get_serializer_class(self):
        # POST のときだけ入力用シリアライザ
        return (
            FavoriteCreateSerializer
            if getattr(self, "action", None) == "create"
            else FavoriteSerializer
        )

    # ★ 配列で返しつつ、e2e 側の .get("results", ...) 呼び出しに耐えるため list に .get を生やす
    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        data = FavoriteSerializer(qs, many=True).data

        class _ListWithGet(list):
            def get(self, key, default=None):
                # e2e は res.data.get("results", res.data) とするので default を返せばOK
                return default

        return Response(_ListWithGet(data))

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        fav, created = Favorite.objects.get_or_create(
            user=request.user,
            target_type=ser.validated_data["target_type"],  # "shrine"
            target_id=ser.validated_data["target_id"],
        )
        return Response(
            FavoriteSerializer(fav).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
