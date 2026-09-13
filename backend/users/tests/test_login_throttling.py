import hashlib
import runpy
from pathlib import Path
from types import SimpleNamespace

import environ
import pytest
from django.core.cache import cache
from django.urls import resolve
from rest_framework.test import APIClient
from rest_framework_simplejwt.views import TokenObtainPairView

from users.api.auth import AuthTokenObtainPairView
from users.throttles import LoginThrottle


@pytest.mark.parametrize("override,disabled,expected", [
    (None, "0", "5/min"),
    ("9/min", "0", "9/min"),
    ("9/min", "1", "1000/min"),
])
def test_settings_rate_and_disable_override(monkeypatch, override, disabled, expected):
    # Isolate the probe from local dotenv values; no DB connection is made.
    monkeypatch.setattr(environ.Env, "read_env", lambda *args, **kwargs: None)
    monkeypatch.delenv("THROTTLE_AUTH_LOGIN", raising=False)
    monkeypatch.setenv("DISABLE_THROTTLE", disabled)
    monkeypatch.setenv("USE_SQLITE", "0")
    if override is not None:
        monkeypatch.setenv("THROTTLE_AUTH_LOGIN", override)
    path = Path(__file__).resolve().parents[2] / "shrine_project" / "settings.py"
    config = runpy.run_path(str(path))
    assert config["REST_FRAMEWORK"]["DEFAULT_THROTTLE_RATES"]["auth_login"] == expected


@pytest.fixture(autouse=True)
def throttle_clock(monkeypatch):
    cache.clear()
    clock = [1000.0]
    monkeypatch.setattr(LoginThrottle, "THROTTLE_RATES", {"auth_login": "5/min"})
    monkeypatch.setattr(LoginThrottle, "timer", lambda self: clock[0])
    yield clock
    cache.clear()


def login(username="user-a", password="wrong"):
    return APIClient().post(
        "/api/auth/jwt/create/", {"username": username, "password": password}, format="json"
    )


@pytest.mark.django_db
def test_failures_limit_identity_isolation_and_expiry(throttle_clock):
    for _ in range(5):
        assert login().status_code == 401
    response = login()
    assert response.status_code == 429
    assert response["Retry-After"] == "60"
    assert set(response.data) == {"detail"}
    assert "user-a" not in str(response.data)
    assert login("user-b").status_code == 401
    throttle_clock[0] += 60
    assert login().status_code == 401


@pytest.mark.django_db
def test_case_and_whitespace_cannot_bypass_limit():
    for username in ["Morietsu", "morietsu", "MORIETSU", " Morietsu ", "morietsu"]:
        assert login(username).status_code == 401
    assert login("MORIETSU").status_code == 429


@pytest.mark.django_db
def test_success_counts_without_reset_and_preserves_credentials(django_user_model):
    django_user_model.objects.create_user(username="MixedCase", password="correct")
    for _ in range(4):
        assert login("MixedCase").status_code == 401
    response = login("MixedCase", "correct")
    assert response.status_code == 200
    assert set(response.data) == {"access", "refresh"}
    assert all(response.data.values())
    response = login("MixedCase", "correct")
    assert response.status_code == 429
    assert set(response.data) == {"detail"}


@pytest.mark.parametrize("username", [" Morietsu ", "MORIETSU", "morietsu", 123])
def test_cache_key_hashes_only_normalized_identity(username):
    request = SimpleNamespace(data={"username": username, "password": "secret"})
    original = request.data.copy()
    key = LoginThrottle().get_cache_key(request, None)
    digest = hashlib.sha256(str(username).strip().lower().encode()).hexdigest()
    assert key == f"throttle_auth_login_{digest}"
    assert str(username) not in key
    assert request.data == original


def test_only_create_uses_login_throttle():
    assert resolve("/api/auth/jwt/create/").func.view_class is AuthTokenObtainPairView
    assert AuthTokenObtainPairView.throttle_classes == [LoginThrottle]
    assert AuthTokenObtainPairView.serializer_class == TokenObtainPairView.serializer_class
    for action in ["refresh", "verify"]:
        view = resolve(f"/api/auth/jwt/{action}/").func.view_class
        assert LoginThrottle not in view.throttle_classes
