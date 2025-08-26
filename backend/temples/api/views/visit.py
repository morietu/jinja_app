from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from temples.models import Shrine, Visit
from ..serializers import VisitSerializer

class VisitCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, shrine_id):
        shrine = get_object_or_404(Shrine, id=shrine_id)
        visit, created = Visit.objects.get_or_create(user=request.user, shrine=shrine)

        if not created:
            visit.delete()
            return Response({"status": "removed"}, status=status.HTTP_200_OK)

        return Response({"status": "added"}, status=status.HTTP_201_CREATED)


class UserVisitListView(generics.ListAPIView):
    serializer_class = VisitSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            Visit.objects
            .filter(user=self.request.user)
            .select_related("shrine")
            .order_by("-visited_at")
        )
