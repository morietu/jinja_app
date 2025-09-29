# backend/temples/debug_views.py
from django.http import JsonResponse


def whoami(request):
    u = request.user
    return JsonResponse(
        {
            "is_authenticated": u.is_authenticated,
            "username": getattr(u, "username", None),
            "is_superuser": getattr(u, "is_superuser", False),
        }
    )
