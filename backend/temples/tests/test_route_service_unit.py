# -*- coding: utf-8 -*-
import os
import math
import contextlib
import importlib
import types
import pytest

from backend.temples import route_service as rs


# --- 小道具 ---
@contextlib.contextmanager
def env(**pairs):
    old = {k: os.environ.get(k) for k in pairs}
    try:
        for k, v in pairs.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = str(v)
        yield
    finally:
        for k, v in old.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v


# --- 基本ユーティリティのテスト ---------------------------------------------


def test_haversine_zero_distance():
    p = rs.Point(lat=35.0, lng=135.0)
    d = rs._haversine_m(p, p)
    assert math.isclose(d, 0.0, abs_tol=1e-9)


def test_interp_line_endpoints_and_count():
    a = rs.Point(35.0, 135.0)
    b = rs.Point(35.1, 135.2)
    pts = list(rs._interp_line(a, b, segments=3))
    # 3分割なら 4点（始点・中間×2・終点）
    assert len(pts) == 4

    # _interp_line は (lat, lng) のタプルを返す前提で比較
    assert pts[0] == (a.lat, a.lng)
    assert pts[-1] == (b.lat, b.lng)

    # 中間点の単調増加（ざっくりチェック）
    lats = [p[0] for p in pts]
    lngs = [p[1] for p in pts]
    assert lats[0] <= lats[-1]
    assert lngs[0] <= lngs[-1]


def test_ck_stability_and_difference():
    k1 = rs._ck("demo", {"a": 1, "b": 2})
    k2 = rs._ck("demo", {"b": 2, "a": 1})  # dict順序が変わっても同じ想定
    k3 = rs._ck("demo", {"a": 1, "b": 3})
    assert isinstance(k1, str)
    assert k1 == k2
    assert k1 != k3


def test_cache_key_is_deterministic():
    mode = "walk"
    o = rs.Point(35.0, 135.0)
    ds = [rs.Point(35.01, 135.02), rs.Point(35.02, 135.03)]
    k1 = rs._cache_key(mode, o, ds)
    k2 = rs._cache_key(mode, o, ds)
    assert k1 == k2
    assert isinstance(k1, str)


# --- アダプタ解決のテスト ---------------------------------------------------


def test_get_adapter_default_is_valid():
    # デフォルト（環境変数未設定）でも、有効な名前とBaseRouteAdapter実装が返る
    name, adapter = rs.get_adapter()
    assert isinstance(name, str)
    assert isinstance(adapter, rs.BaseRouteAdapter)


def test_get_adapter_env_dummy():
    with env(ROUTE_PROVIDER="dummy"):
        importlib.reload(rs)
        name, adapter = rs.get_adapter()
        assert name.lower() == "dummy"
        assert isinstance(adapter, rs.BaseRouteAdapter)


# --- build_route のスモークテスト -------------------------------------------


def test_build_route_smoke_with_dummy_env():
    # dummy であれば外部呼び出しなしで決定論的に動作するはず
    with env(ROUTE_PROVIDER="dummy"):
        importlib.reload(rs)
        origin = rs.Point(35.0, 135.0)
        destinations = [rs.Point(35.005, 135.01), rs.Point(35.01, 135.02)]
        out = rs.build_route(mode="walk", origin=origin, destinations=destinations)
        assert isinstance(out, dict)
        # 代表的な期待値（フィールド名は実装に依存するため緩めのアサーション）
        assert out  # 空でなければOK（距離や座標列など何かしら返っている）
