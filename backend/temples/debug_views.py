# backend/temples/debug_views.py
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from rest_framework_simplejwt.authentication import JWTAuthentication

@api_view(["GET"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAdminUser])
def whoami(request):
    u = request.user
    return Response({
        "is_authenticated": bool(getattr(u, "is_authenticated", False)),
        "id": getattr(u, "id", None),
        "username": getattr(u, "username", None),
    })
