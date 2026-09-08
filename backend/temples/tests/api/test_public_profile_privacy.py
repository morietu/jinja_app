import datetime

import pytest
from django.contrib.auth import get_user_model

from users.models import UserProfile


pytestmark = pytest.mark.django_db


@pytest.fixture
def public_user():
    user = get_user_model().objects.create_user(
        username="public-profile-user",
        password="test-password",
    )
    profile, _ = UserProfile.objects.update_or_create(
        user=user,
        defaults={
            "nickname": "公開ユーザー",
            "is_public": True,
            "birthday": datetime.date(1990, 1, 2),
        },
    )
    return user, profile


def test_public_profile_does_not_expose_birthday(client, public_user):
    user, _profile = public_user

    response = client.get(f"/api/profiles/{user.username}/")

    assert response.status_code == 200
    data = response.json()
    assert data["username"] == user.username
    assert data["nickname"] == "公開ユーザー"
    assert "birthday" not in data


def test_private_profile_still_returns_404(client, public_user):
    user, profile = public_user
    profile.is_public = False
    profile.save(update_fields=["is_public"])

    response = client.get(f"/api/profiles/{user.username}/")

    assert response.status_code == 404
