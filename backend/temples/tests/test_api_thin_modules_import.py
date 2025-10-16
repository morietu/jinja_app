import importlib
import pytest


@pytest.mark.parametrize(
    "modname",
    [
        "temples.api.authentication",
        "temples.api.throttles",
        "temples.api.serializers.visit",
    ],
)
def test_import_smoke(modname):
    # import に成功すれば top-level のコードはカバーされる
    m = importlib.import_module(modname)
    assert m is not None
