import pytest
from django.urls import reverse

@pytest.mark.django_db
def test_me_url_resolves():
    assert reverse("users_api:me") == "/api/users/me/"
