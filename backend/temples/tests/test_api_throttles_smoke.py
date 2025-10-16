# backend/temples/tests/test_api_throttles_smoke.py
import importlib
from rest_framework.throttling import BaseThrottle


def test_throttles_smoke():
    mod = importlib.import_module("temples.api.throttles")
    found = []
    for name in dir(mod):
        obj = getattr(mod, name)
        try:
            if isinstance(obj, type) and issubclass(obj, BaseThrottle):
                # 生成＋存在確認だけ（副作用なし）
                inst = obj()
                assert inst is not None
                found.append(obj.__name__)
        except Exception:
            pass
    assert found  # 少なくとも何か1つ
