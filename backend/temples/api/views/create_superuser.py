# backend/temples/api/views/create_superuser.py
from django.http import JsonResponse
from django.contrib.auth import get_user_model

def create_superuser(request):
    User = get_user_model()

    username = "morietsu"
    password = "jdb50515"
    email = "morietsu@example.com"

    user, created = User.objects.get_or_create(
        username=username,
        defaults={"email": email},
    )

    user.is_staff = True
    user.is_superuser = True
    user.set_password(password)
    user.save()

    return JsonResponse({
        "ok": True,
        "created": created,
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
    })
