from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.views import APIView

from .models import Shrine, Favorite          # ← Shrine を追加
from .api.serializers import ShrineSerializer, FavoriteSerializer, FavoriteUpsertSerializer
from .services.places import text_search, get_or_sync_place, PlacesError


class ShrineViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET /api/shrines/
    GET /api/shrines/{id}/
    匿名閲覧OK（書き込みなし）
    """
    queryset = Shrine.objects.all().order_by("id")
    serializer_class = ShrineSerializer
    authentication_classes = [JWTAuthentication]   # 読み取り専用なのであっても可
    permission_classes = [permissions.AllowAny]    # or IsAuthenticatedOrReadOnly


class FavoriteViewSet(viewsets.ModelViewSet):
    """
    /api/favorites/ で自分のお気に入りをCRUD
    POST: {"shrine_id": <int>} を受け付ける（serializerで shrine にマップせず、ここで処理）
    """
    serializer_class = FavoriteSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # 自分の分だけ（神社を同時取得）
        return (
            Favorite.objects
            .select_related("shrine")
            .filter(user=self.request.user)
            .order_by("-id")
        )
    def get_serializer_class(self):
        # 書き込み時は Upsert（shrine_id / place_id のどちらでも受け付け）
        if self.request.method in ("POST", "PUT", "PATCH"):
            return FavoriteUpsertSerializer
        return FavoriteSerializer

    # 冪等: 既存があれば 200、無ければ作成して 201
    def create(self, request, *args, **kwargs):
        shrine_id = request.data.get("shrine_id")
        place_id  = request.data.get("place_id")
        if not shrine_id and not place_id:
            return Response(
                {"detail": "either shrine_id or place_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            if place_id:
                # PlaceRef を同期（将来の参照のため）
                get_or_sync_place(place_id)
                obj, created = Favorite.objects.get_or_create(
                    user=request.user, place_id=place_id
                )
            else:
                obj, created = Favorite.objects.get_or_create(
                    user=request.user, shrine_id=shrine_id
                )
        except PlacesError as e:
            return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)

        data = FavoriteSerializer(obj).data
        return Response(
            data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class PlacesSearchView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        q = request.GET.get("q")
        lat = request.GET.get("lat")
        lng = request.GET.get("lng")
        if not q:
            return Response({"detail": "q is required"}, status=status.HTTP_400_BAD_REQUEST)
        lat_f = float(lat) if lat else None
        lng_f = float(lng) if lng else None
        try:
            data = text_search(q, lat_f, lng_f)
            return Response(data, status=status.HTTP_200_OK)
        except PlacesError as e:
            return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)


class PlacesDetailView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request, place_id: str):
        try:
            rec = get_or_sync_place(place_id)
            return Response({
                "place_id": rec.place_id,
                "name": rec.name,
                "address": rec.address,
                "location": {"lat": rec.latitude, "lng": rec.longitude},
                "snapshot": rec.snapshot_json,
                "synced_at": rec.synced_at,
            }, status=status.HTTP_200_OK)
        except PlacesError as e:
            return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)