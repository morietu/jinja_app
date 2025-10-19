from django.urls import reverse
import pytest


@pytest.mark.django_db
def test_search_missing_required_param_returns_400(client):
    url = reverse("temples:places-search")
    # 必須パラメータ（bounds / query など）を入れずに叩くと 400 を期待
    resp = client.get(url)
    assert resp.status_code == 400


@pytest.mark.django_db
def test_search_invalid_bounds_returns_400(client):
    url = reverse("temples:places-search")
    # 不正な bounds 形式で 400 を期待（ビューの実装に合わせて最低限の形だけ渡す）
    resp = client.get(url, {"bounds": "1,2,3"})  # 4要素じゃない
    assert resp.status_code == 400
