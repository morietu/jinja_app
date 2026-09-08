import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse

from tests.utils import api_client_as
from users.models import UserProfile


ME_URL_NAME = "users_api:me"
User = get_user_model()


@pytest.mark.django_db
def test_new_user_profile_is_private_by_default():
    user = User.objects.create_user(username="private-default", password="test-pass-123")

    profile = UserProfile.objects.get(user=user)
    assert profile.is_public is False


@pytest.mark.django_db
def test_model_default_creates_private_profile_when_no_explicit_visibility_is_given():
    user = User.objects.create_user(username="model-default", password="test-pass-123")
    UserProfile.objects.filter(user=user).delete()

    profile, created = UserProfile.objects.get_or_create(user=user)

    assert created is True
    assert profile.is_public is False


@pytest.mark.django_db
def test_me_get_lazy_profile_creation_is_private_by_default():
    user = User.objects.create_user(username="me-get-default", password="test-pass-123")
    UserProfile.objects.filter(user=user).delete()

    response = api_client_as(user).get(reverse(ME_URL_NAME))

    assert response.status_code == 200
    profile = UserProfile.objects.get(user=user)
    assert profile.is_public is False
    assert response.json()["profile"]["is_public"] is False


@pytest.mark.django_db
def test_me_patch_lazy_profile_creation_uses_private_model_default():
    user = User.objects.create_user(username="me-patch-default", password="test-pass-123")
    UserProfile.objects.filter(user=user).delete()

    response = api_client_as(user).patch(
        reverse(ME_URL_NAME),
        {"nickname": "表示名"},
        format="json",
    )

    assert response.status_code == 200
    profile = UserProfile.objects.get(user=user)
    assert profile.nickname == "表示名"
    assert profile.is_public is False


@pytest.mark.django_db
def test_user_can_explicitly_enable_public_profile_after_private_default():
    user = User.objects.create_user(username="public-opt-in", password="test-pass-123")

    response = api_client_as(user).patch(
        reverse(ME_URL_NAME),
        {"is_public": True},
        format="json",
    )

    assert response.status_code == 200
    profile = UserProfile.objects.get(user=user)
    assert profile.is_public is True
    assert response.json()["profile"]["is_public"] is True
