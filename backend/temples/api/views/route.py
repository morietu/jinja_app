# backend/temples/api/views/route.py
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView


class RouteView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):
        # TODO: Google Maps API と接続
        return Response({"message": "Route API placeholder"})
