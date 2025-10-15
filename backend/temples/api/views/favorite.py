# temples/api/views/favorite.py
from common.serializers import EmptySerializer

# スキーマ注釈用（最小限）
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema

# ★足りていなかったこれを追加
from rest_framework import generics, serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication
from temples.models import Favorite

from ..serializers.favorite import FavoriteSerializer, FavoriteUpsertSerializer


class FavoriteToggleRequestSerializer(serializers.Serializer):
    target_type = serializers.ChoiceField(choices=["shrine"])
    target_id = serializers.IntegerField(min_value=1)


class FavoriteToggleView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    throttle_scope = "favorites"

    @extend_schema(
        summary="Toggle my favorite",
        request=FavoriteToggleRequestSerializer,
        responses={200: FavoriteSerializer},
        tags=["favorites"],
    )
    def post(self, request, *args, **kwargs):
        # 既存のトグル実装そのまま
        s = FavoriteToggleRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        target_type = s.validated_data["target_type"]
        target_id = s.validated_data["target_id"]

        fav, created = Favorite.objects.get_or_create(
            user=request.user, target_type=target_type, target_id=target_id
        )
        if not created:
            fav.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(FavoriteSerializer(fav).data, status=status.HTTP_201_CREATED)


class MyFavoritesListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    throttle_scope = "favorites"
    queryset = Favorite.objects.all()

    def get_queryset(self):
        return Favorite.objects.filter(user=self.request.user).order_by("-id")

    # GET は FavoriteSerializer、POST は FavoriteUpsertSerializer を受ける
    def get_serializer_class(self):
        if self.request and self.request.method == "POST":
            return FavoriteUpsertSerializer
        return FavoriteSerializer

    @extend_schema(
        summary="List my favorites",
        responses={200: FavoriteSerializer(many=True)},
        tags=["favorites"],
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        summary="Create a favorite",
        request=FavoriteUpsertSerializer,
        responses={201: FavoriteSerializer},
        tags=["favorites"],
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


class MyFavoriteDestroyView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    throttle_scope = "favorites"

    @extend_schema(
        summary="Delete my favorite",
        # ルーティングは /api/favorites/<int:id>/ なので、path param は "id" と明示
        parameters=[OpenApiParameter("id", OpenApiTypes.INT, OpenApiParameter.PATH, required=True)],
        request=None,
        responses={204: EmptySerializer},
        tags=["favorites"],
    )
    def delete(self, request, favorite_id: int, *args, **kwargs):
        Favorite.objects.filter(user=request.user, id=favorite_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
