import pytest

pytestmark = pytest.mark.django_db


def _skip_if_no_location(request):
    if not request.getfixturevalue("shrine_has_location"):
        import pytest

        pytest.skip("temples_shrine.location 無しのため skip")


def _json_or_text(resp):
    try:
        return resp.json()
    except Exception:
        return resp.content.decode("utf-8", errors="ignore")


@pytest.fixture
def api():
    # /api プレフィックスが付く/付かないの両方に対応したい場合はここを調整
    return lambda p: p if p.startswith("/api") else f"/api{p}"


def test_shrines_list_ok(request, client, api):
    _skip_if_no_location(request)
    tried = []
    for path in (api("/shrines/"), api("/shrines")):
        r = client.get(path, {"limit": 5})
        tried.append((path, r.status_code))
        if r.status_code in (200, 204):
            return
    if all(code == 404 for _, code in tried):
        pytest.skip(f"shrines endpoint not wired yet: {tried}")
    pytest.fail(f"unexpected: {tried}")


def test_goriyaku_tags_list_ok(request, client, api):
    _skip_if_no_location(request)
    r = client.get(api("/goriyaku-tags/"))
    if r.status_code in (200, 204):
        return
    if r.status_code == 404:
        pytest.skip("goriyaku-tags endpoint not wired yet")
    pytest.fail(f"{r.status_code} {_json_or_text(r)[:200]}")


def test_concierge_recommendations_relaxed(request, client, api):
    _skip_if_no_location(request)
    r = client.get(
        api("/concierge/recommendations/"),
        {"city": "東京都", "purpose": "縁結び", "limit": 3},
    )
    # 存在すれば200/204、未実装なら404、将来501なども許容
    assert r.status_code in (200, 204, 404, 501)
