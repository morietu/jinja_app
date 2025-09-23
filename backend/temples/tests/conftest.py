# temples/tests/conftest.py
import os
import pytest
import responses as httpmock
from rest_framework.test import APIClient
import decimal
from decimal import Decimal
import contextlib
from django.db.models.signals import pre_save


# --- 既存の自動ジオコーディングをモックして Shrine の lat/lng を埋める ---
@pytest.fixture(autouse=True, scope="session")
def _block_real_http():
    if os.getenv("CI") == "true":
        with httpmock.RequestsMock(assert_all_requests_are_fired=False) as rsps:
            rsps.add_passthru("http://localhost")
            rsps.add_passthru("https://localhost")
            # allow nothing else
            yield
    else:
        yield


# --- テストが参照する追加フィクスチャ ---
@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def endpoint_path():
    # concierge エンドポイントのベースパス
    return "/api/concierge/plan/"


@pytest.fixture
def req_history(monkeypatch):
    # 低レイヤの google_places を直接フック
    from temples.services import google_places

    hist = []

    # 元のログ関数を退避
    orig = google_places._log_upstream

    def tap(tag: str, url: str, params: dict):
        # アサート用に (url, params) を保存
        hist.append((url, dict(params or {})))
        # 既存のログ出力は維持
        return orig(tag, url, params)

    # ログ関数を差し替え（各API呼び出し時に必ず通る）
    monkeypatch.setattr(google_places, "_log_upstream", tap, raising=True)

    try:
        yield hist
    finally:
        # 念のため元に戻す（他テストへの影響防止）
        monkeypatch.setattr(google_places, "_log_upstream", orig, raising=True)


@pytest.fixture
def shrine_has_location():
    # マーカー用（テスト内で使われるだけ）。ここでは何もしない。
    return True


@pytest.fixture(autouse=True)
def _mock_geocode(monkeypatch):
    """
    テスト中は住所→緯度経度の解決をダミーにする（経路や権限系で外部依存を切る）
    使っていないなら、このフィクスチャは不要です。
    """
    try:
        # 実際に geocode を使うモジュールへ合わせて import 先を調整してください
        # 例: temples.utils.geo など
        from temples.utils import geo as _geo_mod  # ← 実プロジェクトのパスに合わせて
    except Exception:
        # そのモジュールが無ければ何もしない
        yield
        return

    class _Geo:  # 返り値の簡易スタブ
        lat = 35.0
        lon = 139.0
        formatted_address = "テスト住所"

    def fake_geocode_address(*a, **k):
        return _Geo

    monkeypatch.setattr(_geo_mod, "geocode_address", fake_geocode_address, raising=False)
    yield


def _ensure_shrine_coords():
    """テスト中、Shrine に座標が無ければデフォルトを入れる（IntegrityError回避）"""
    from temples.models import Shrine

    def _inject(sender, instance, **kwargs):
        if instance.latitude is None:
            instance.latitude = decimal.Decimal("35.0000")
        if instance.longitude is None:
            instance.longitude = decimal.Decimal("139.0000")

    pre_save.connect(_inject, sender=Shrine, weak=False)
    try:
        yield
    finally:
        pre_save.disconnect(_inject, sender=Shrine)


def _ensure_shrine_coords(db):
    """
    テスト中、Shrine に座標が無ければデフォルト値を自動補完して IntegrityError を回避。
    実装は触らずに、テストだけで安全に通すための保険。
    """
    from temples.models import Shrine

    def _inject(sender, instance, **kwargs):
        if isinstance(instance, Shrine):
            if instance.latitude is None:
                instance.latitude = Decimal("35.681236")  # 東京駅あたり
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
