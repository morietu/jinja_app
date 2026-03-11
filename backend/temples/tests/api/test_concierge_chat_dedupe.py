import json
import pytest

URL = "/api/concierge/chat/"


@pytest.mark.django_db
def test_concierge_chat_dedupes_user_and_built_candidates_by_place_id(
    client, monkeypatch, settings
):
    settings.CONCIERGE_USE_LLM = False

    import temples.api_views_concierge as concierge_mod
    captured = {}

    monkeypatch.setattr(
        concierge_mod,
        "build_chat_candidates",
        lambda **kwargs: [
            {
                "place_id": "PID_DUP",
                "name": "重複神社",
                "address": "東京都千代田区1-1",
                "lat": 35.0,
                "lng": 139.0,
                "distance_m": 120,
                "popular_score": 5.0,
                "astro_tags": ["mental"],
            },
            {
                "place_id": "PID_ONLY_BUILT",
                "name": "別神社",
                "address": "東京都千代田区2-2",
                "lat": 35.01,
                "lng": 139.01,
                "distance_m": 220,
                "popular_score": 4.0,
                "astro_tags": ["rest"],
            },
        ],
        raising=True,
    )

    def fake_build_chat_recommendations(**kwargs):
        captured["candidates"] = kwargs["candidates"]
        return {"recommendations": kwargs["candidates"][:3]}

    monkeypatch.setattr(
        concierge_mod,
        "build_chat_recommendations",
        fake_build_chat_recommendations,
        raising=True,
    )

    payload = {
        "message": "近場で静かに参拝したい",
        "lat": 35.0,
        "lng": 139.0,
        "candidates": [
            {
                "place_id": "PID_DUP",
                "name": "重複神社",
                "address": "東京都千代田区1-1",
                "lat": 35.0,
                "lng": 139.0,
                "distance_m": 100,
                "popular_score": 8.0,
                "astro_tags": ["mental", "rest"],
            }
        ],
    }

    r = client.post(URL, data=json.dumps(payload), content_type="application/json")
    assert r.status_code == 200

    body = r.json()
    assert body["ok"] is True

    debug = body["_debug"]
    assert debug["before"] == 2

    cands = captured["candidates"]
    assert len(cands) == 2
    assert [c.get("place_id") for c in cands] == ["PID_DUP", "PID_ONLY_BUILT"]


@pytest.mark.django_db
def test_concierge_chat_dedupe_keeps_user_candidate_first(client, monkeypatch, settings):
    settings.CONCIERGE_USE_LLM = False

    import temples.api_views_concierge as concierge_mod
    captured = {}

    monkeypatch.setattr(
        concierge_mod,
        "build_chat_candidates",
        lambda **kwargs: [
            {
                "place_id": "PID_DUP",
                "name": "重複神社",
                "address": "東京都千代田区1-1",
                "popular_score": 1.0,
                "astro_tags": [],
            }
        ],
        raising=True,
    )

    def fake_build_chat_recommendations(**kwargs):
        captured["candidates"] = kwargs["candidates"]
        return {"recommendations": kwargs["candidates"][:3]}

    monkeypatch.setattr(
        concierge_mod,
        "build_chat_recommendations",
        fake_build_chat_recommendations,
        raising=True,
    )

    payload = {
        "message": "近場で参拝したい",
        "lat": 35.0,
        "lng": 139.0,
        "candidates": [
            {
                "place_id": "PID_DUP",
                "name": "重複神社",
                "address": "東京都千代田区1-1",
                "popular_score": 9.0,
                "astro_tags": ["rest"],
                "source": "user",
            }
        ],
    }

    r = client.post(URL, data=json.dumps(payload), content_type="application/json")
    assert r.status_code == 200

    cands = captured["candidates"]
    target = next(x for x in cands if x.get("place_id") == "PID_DUP")

    assert target["source"] == "user"
