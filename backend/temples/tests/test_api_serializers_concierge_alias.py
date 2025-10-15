from temples.api.serializers import concierge as alias
from temples.serializers import concierge as impl


def test_concierge_alias_exports_and_identities():
    expected = {
        "LocationSerializer",
        "PlaceLiteSerializer",
        "ConciergePlanRequestSerializer",
        "ConciergePlanResponseSerializer",
    }
    # __all__ のエクスポートを確認
    assert set(alias.__all__) == expected

    # 実体が本体モジュールのクラスと一致していることを確認
    assert alias.LocationSerializer is impl.LocationSerializer
    assert alias.PlaceLiteSerializer is impl.PlaceLiteSerializer
    assert alias.ConciergePlanRequestSerializer is impl.ConciergePlanRequestSerializer
    assert alias.ConciergePlanResponseSerializer is impl.ConciergePlanResponseSerializer
