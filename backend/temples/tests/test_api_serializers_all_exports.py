import importlib


def test_serializers_package_import_and_exports():
    pkg = importlib.import_module("temples.api.serializers")
    assert pkg is not None

    # 代表的な re-export が実体に解決できることを確認
    from temples.api.serializers import (
        PlaceLiteSerializer,
        ConciergePlanRequestSerializer,
        ConciergePlanResponseSerializer,
        LocationSerializer,
    )

    for cls in (
        PlaceLiteSerializer,
        ConciergePlanRequestSerializer,
        ConciergePlanResponseSerializer,
        LocationSerializer,
    ):
        assert cls is not None


def test_all_exports_are_importable_and_have_value():
    pkg = importlib.import_module("temples.api.serializers")
    exported_names = getattr(pkg, "__all__", None)
    assert exported_names, "__all__ が定義されていて空ではないこと"

    for name in exported_names:
        # getattr で AttributeError が出なければ OK、実体が None でもないことを確認
        obj = getattr(pkg, name)
        assert obj is not None, f"{name} is None"
