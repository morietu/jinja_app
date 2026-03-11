import json
import pytest

URL = "/api/concierge/chat/"


@pytest.mark.django_db
def test_concierge_chat_dedupes_user_and_built_candidates_by_place_id(
    client, monkeypatch, settings
):
    settings.CONCIERGE_USE_LLM = False

    import temples.api_views_concierge as concierge_mod
    import temples.services.concierge_chat as chat_mod

    monkeypatch.setattr(chat_mod, "_apply_location_backfill", lambda *args, **kwargs: None)

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
    assert debug["before"] == 2  # user1 + built2 -> dedupe後の candidates 数を見てるならここは実装次第
    # 実装上 before は len(candidates) を見ているので、今のコードなら 2
    # merged は 3 だが deduped は 2

    recs = body["data"]["recommendations"]
    names = [x["name"] for x in recs if isinstance(x, dict)]

    assert names.count("重複神社") == 1


@pytest.mark.django_db
def test_concierge_chat_dedupe_keeps_user_candidate_first(client, monkeypatch, settings):
    settings.CONCIERGE_USE_LLM = False

    import temples.api_views_concierge as concierge_mod
    import temples.services.concierge_chat as chat_mod

    monkeypatch.setattr(chat_mod, "_apply_location_backfill", lambda *args, **kwargs: None)

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
            }
        ],
    }

    r = client.post(URL, data=json.dumps(payload), content_type="application/json")
    assert r.status_code == 200

    recs = body = r.json()["data"]["recommendations"]
    target = next(x for x in recs if x["name"] == "重複神社")

    # user_candidates が先勝ちしていれば rest が残る可能性が高い
    assert "rest" in (target.get("astro_tags") or [])
