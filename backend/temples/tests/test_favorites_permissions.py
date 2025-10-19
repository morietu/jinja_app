import types
import pytest
from django.contrib.auth.models import AnonymousUser, User
from rest_framework.test import APIRequestFactory

# パスは実装位置に合わせて
from favorites.permissions import IsOwnerOrReadOnly

rf = APIRequestFactory()


@pytest.mark.django_db
def test_safe_methods_are_allowed_for_anyone():
    req = rf.get("/dummy")
    req.user = AnonymousUser()
    obj = types.SimpleNamespace(user=User())  # 参照だけできればOK
    assert (
        IsOwnerOrReadOnly().has_object_permission(req, view=types.SimpleNamespace(), obj=obj)
        is True
    )


@pytest.mark.django_db
def test_owner_can_modify_non_safe_methods():
    user = User.objects.create_user(username="owner")
    obj = types.SimpleNamespace(user=user)
    req = rf.patch("/dummy", {})
    req.user = user
    assert (
        IsOwnerOrReadOnly().has_object_permission(req, view=types.SimpleNamespace(), obj=obj)
        is True
    )


@pytest.mark.django_db
def test_non_owner_cannot_modify_non_safe_methods():
    owner = User.objects.create_user(username="owner")
    other = User.objects.create_user(username="other")
    obj = types.SimpleNamespace(user=owner)
    req = rf.delete("/dummy")
    req.user = other
    assert (
        IsOwnerOrReadOnly().has_object_permission(req, view=types.SimpleNamespace(), obj=obj)
        is False
    )
