# backend/temples/api/views/public_profile.py
from django.contrib.auth import get_user_model
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

User = get_user_model()


@api_view(["GET"])
@permission_classes([AllowAny])
def public_profile(request, username: str):
    try:
        user = User.objects.select_related("profile").get(username=username)
    except User.DoesNotExist:
        return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    profile = user.profile

    # 公開フラグを見て非公開なら 404 扱いにする
    if not getattr(profile, "is_public", False):
        return Response({"detail": "Profile is not public"}, status=status.HTTP_404_NOT_FOUND)

    data = {
        "username": user.username,
        "nickname": getattr(profile, "nickname", "") or user.username,
        "website": getattr(profile, "website", None),
        "icon_url": getattr(profile, "icon_url", None),
        "bio": getattr(profile, "bio", None),
        "birthday": getattr(profile, "birthday", None),
        "location": getattr(profile, "location", None),
        "is_public": getattr(profile, "is_public", False),
    }
    return Response(data)
