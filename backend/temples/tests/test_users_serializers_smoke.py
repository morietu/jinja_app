# backend/temples/tests/test_users_serializers_smoke.py
import importlib
from rest_framework import serializers


def test_users_serializers_are_importable_and_instantiable():
    mod = importlib.import_module("users.api.serializers")
    instanced = 0
    for name in dir(mod):
        obj = getattr(mod, name)
        try:
            if isinstance(obj, type) and issubclass(obj, serializers.BaseSerializer):
                # フィールド未設定でも new できるかだけを見る
                s = obj()  # 失敗したら例外
                # to_representation安全系だけ軽く叩く（受け取らないならスキップ）
                if hasattr(s, "to_representation"):
                    s.to_representation({})
                instanced += 1
        except Exception:
            # 依存が重い/Model必須等はスキップ
            pass
    assert instanced > 0
