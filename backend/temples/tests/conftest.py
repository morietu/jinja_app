# temples/tests/conftest.py
import contextlib
import json
import os
import re
from decimal import Decimal

import pytest
import responses as httpmock
from django.db import connection
from django.db.models.signals import pre_save
from rest_framework.test import APIClient


def _has_postgis():
    try:
        with connection.cursor() as cur:
            cur.execute("SELECT postgis_version();")
            cur.fetchone()
        return True
    except Exception:
        return False


def pytest_runtest_setup(item):
    if "postgis" in item.keywords and not _has_postgis():
        pytest.skip("PostGIS is not available in this environment.")


# ---- ネットワーク遮断（CIのみ・localhostだけ通す）----
@pytest.fixture(autouse=True, scope="session")
def _block_real_http():
    if os.getenv("CI") == "true":
        with httpmock.RequestsMock(assert_all_requests_are_fired=False) as rsps:
            rsps.add_passthru("http://localhost")
            rsps.add_passthru("https://localhost")
            yield
    else:
        yield


def _disable_auto_geocode_signal():
    if os.getenv("CI") == "true" or os.getenv("PYTEST_CURRENT_TEST"):
        try:
            from temples import signals as sig
            from temples.models import Shrine
        except Exception:
            yield
            return
        # dispatch_uid が一致しなくても外れるように try でラップ
        with contextlib.suppress(Exception):
            pre_save.disconnect(
                sig.auto_geocode_on_save,
                sender=Shrine,
                dispatch_uid="temples.auto_geocode_on_save",
            )
        with contextlib.suppress(Exception):
            # 念のため uid なしでも外す
            pre_save.disconnect(sig.auto_geocode_on_save, sender=Shrine)
    yield


@pytest.fixture
def http_mock():
    # 全テストで使い回すレスポンス・モッカー
    with httpmock.RequestsMock(assert_all_requests_are_fired=False) as rsps:
        rsps.add_passthru("http://localhost")
        rsps.add_passthru("https://localhost")
        yield rsps


# ---- Shrine 保存時に lat/lng を自動補完して IntegrityError を避ける ----
@pytest.fixture(autouse=True)
def _ensure_shrine_coords(db):
    from temples.models import Shrine

    def _inject(sender, instance, **kwargs):
        if isinstance(instance, Shrine):
            if instance.latitude is None:
                instance.latitude = Decimal("35.681236")  # 東京駅付近
            if instance.longitude is None:
                instance.longitude = Decimal("139.767125")

    pre_save.connect(
        _inject,
        sender=Shrine,
        weak=False,
        dispatch_uid="tests.ensure_shrine_coords",
    )
    try:
        yield
    finally:
        with contextlib.suppress(Exception):
            pre_save.disconnect(
                _inject,
                sender=Shrine,
                dispatch_uid="tests.ensure_shrine_coords",
            )


# ---- APIClient ----
@pytest.fixture
def api_client():
    return APIClient()


# ---- concierge のベースURL ----
@pytest.fixture
def endpoint_path():
    return "/api/concierge/plan/"


# ---- Google Places ログをフック（既存テストのまま）----
@pytest.fixture
def req_history(monkeypatch):
    from temples.services import google_places

    hist = []
    orig = google_places._log_upstream

    def tap(tag: str, url: str, params: dict):
        hist.append((url, dict(params or {})))
        return orig(tag, url, params)

    monkeypatch.setattr(google_places, "_log_upstream", tap, raising=True)
    try:
        yield hist
    finally:
        monkeypatch.setattr(google_places, "_log_upstream", orig, raising=True)


# ---- 一部テストが参照するダミーフィクスチャ ----
@pytest.fixture
def shrine_has_location():
    return True


# ---- OpenAI を使うオーケストレータを丸ごとモック（OpenAI には飛ばさない）----
@pytest.fixture(autouse=True)
def _mock_orchestrator(monkeypatch):
    try:
        from temples.llm.orchestrator import ConciergeOrchestrator
    except Exception:
        # モジュール未ロードなら何もしない
        yield
        return

    def _fake_suggest(self, query, candidates):
        # 既存 API/テストが読む形に合わせた固定レスポンス
        return {
            "recommendations": [
                {
                    "id": "PID_AKASAKA",
                    "name": "赤坂氷川神社",
                    "formatted_address": "東京都港区赤坂6-10-12",
                    "reason": "dummy",
                }
            ]
        }

    monkeypatch.setattr(ConciergeOrchestrator, "suggest", _fake_suggest, raising=True)
    yield  # 個別テストでさらに monkeypatch する場合はそちらが後勝ち


# ---- Google Places を広めにモック（パラメータ違いでも拾えるよう regex で）----
@pytest.fixture(autouse=True)
def _mock_google_places(http_mock):
    # Find Place From Text
    http_mock.add(
        httpmock.GET,
        re.compile(r"https://maps\.googleapis\.com/maps/api/place/findplacefromtext/json.*"),
        json={
            "candidates": [
                {
                    "place_id": "PID_AKASAKA",
                    "name": "赤坂氷川神社",
                    "formatted_address": "日本、〒107-0052 東京都港区赤坂6丁目10−12",
                    "geometry": {"location": {"lat": 35.671, "lng": 139.736}},
                }
            ]
        },
        status=200,
    )

    # Details
    http_mock.add(
        httpmock.GET,
        re.compile(r"https://maps\.googleapis\.com/maps/api/place/details/json.*"),
        json={
            "result": {
                "formatted_address": "日本、〒107-0052 東京都港区赤坂6丁目10−12",
                "geometry": {"location": {"lat": 35.671, "lng": 139.736}},
            }
        },
        status=200,
    )

    # Geocode
    http_mock.add(
        httpmock.GET,
        re.compile(r"https://maps\.googleapis\.com/maps/api/geocode/json.*"),
        json={"results": [{"geometry": {"location": {"lat": 35.6812, "lng": 139.7671}}}]},
        status=200,
    )

    # conftest.py の _mock_google_places 内、Geocode の上でも下でもOK
    http_mock.add(
        httpmock.GET,
        re.compile(r"https://maps\.googleapis\.com/maps/api/place/textsearch/json.*"),
        json={
            "status": "OK",
            "results": [
                {
                    "name": "明治神宮",
                    "place_id": "PID_MEIJI",
                    "formatted_address": "東京都渋谷区代々木神園町1-1",
                    "geometry": {"location": {"lat": 35.676, "lng": 139.699}},
                }
            ],
            "next_page_token": None,
        },
        status=200,
    )
    yield


@pytest.fixture(autouse=True)
def _ensure_shrine_exists(db):
    from temples.models import Shrine

    if not Shrine.objects.filter(pk=1).exists():
        # ※ Shrine.location が NOT NULL の場合は Point も入れてください
        # from django.contrib.gis.geos import Point
        # Shrine.objects.create(pk=1, name_jp="テスト神社", address="東京都",
        #                       latitude=35.0, longitude=135.0,
        #                       location=Point(135.0, 35.0, srid=4326))
        Shrine.objects.create(pk=1, name_jp="テスト神社", address="東京都")


@pytest.fixture(name="api")
def api_fixture(api_client):
    # 既存の api_client をそのまま api という名前で使う
    return api_client


@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user(
        username="u1", email="u1@example.com", password="pw"
    )


@pytest.fixture
def other_user(django_user_model):
    return django_user_model.objects.create_user(
        username="u2", email="u2@example.com", password="pw"
    )


@pytest.fixture(autouse=True)
def _reset_shrine_id_sequence():
    if connection.vendor == "postgresql":
        with connection.cursor() as cur:
            cur.execute(
                """
                SELECT setval(
                  pg_get_serial_sequence('"temples_shrine"', 'id'),
                  GREATEST((SELECT COALESCE(MAX(id), 1) FROM "temples_shrine"), 1),
                  true
                );
            """
            )
