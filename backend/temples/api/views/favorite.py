from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from temples.models import Shrine, Favorite
from ..serializers import ShrineListSerializer

class FavoriteToggleView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, shrine_id):
        shrine = get_object_or_404(Shrine, id=shrine_id)
        favorite, created = Favorite.objects.get_or_create(user=request.user, shrine=shrine)
        if not created:
            favorite.delete()
            return Response({"status": "removed"}, status=status.HTTP_200_OK)
        return Response({"status": "added"}, status=status.HTTP_201_CREATED)


class UserFavoriteListView(generics.ListAPIView):
    serializer_class = ShrineListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Shrine.objects.filter(favorited_by__user=self.request.user)
