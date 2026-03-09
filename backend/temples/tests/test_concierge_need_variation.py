import pytest
import temples.services.concierge_chat as chat_mod

from temples.services.concierge_chat import build_chat_recommendations




@pytest.mark.django_db
def test_need_variation_changes_matched_tags_and_score(monkeypatch):
    monkeypatch.setattr(chat_mod, "_apply_location_backfill", lambda *args, **kwargs: None)

    candidates = [
        {
            "name": "恋愛神社",
            "lat": 35.0,
            "lng": 139.0,
            "distance_m": 100,
            "goriyaku": "縁結び・恋愛成就・良縁",
            "description": "恋愛やご縁で有名",
            "astro_tags": ["love"],
            "astro_elements": [],
            "astro_priority": 0,
            "popular_score": 5,
        },
        {
            "name": "仕事神社",
            "lat": 35.1,
            "lng": 139.1,
            "distance_m": 100,
            "goriyaku": "仕事運・出世・勝運",
            "description": "仕事や転機を後押し",
            "astro_tags": ["career"],
            "astro_elements": [],
            "astro_priority": 0,
            "popular_score": 5,
        },
        {
            "name": "厄除け神社",
            "lat": 35.2,
            "lng": 139.2,
            "distance_m": 100,
            "goriyaku": "厄除け・浄化・心願成就",
            "description": "不安や気持ちを整える",
            "astro_tags": ["mental"],
            "astro_elements": [],
            "astro_priority": 0,
            "popular_score": 5,
        },
        {
            "name": "金運神社",
            "lat": 35.3,
            "lng": 139.3,
            "distance_m": 100,
            "goriyaku": "金運・財運・福徳",
            "description": "金運上昇で知られる",
            "astro_tags": ["money"],
            "astro_elements": [],
            "astro_priority": 0,
            "popular_score": 5,
        },
    ]

    cases = [
        ("近場で縁結び", "love", "恋愛神社"),
        ("仕事運を上げたい", "career", "仕事神社"),
        ("不安が強いので厄除けしたい", "mental", "厄除け神社"),
        ("金運を上げたい", "money", "金運神社"),
    ]

    results = {}
    for query, expected_tag, expected_top_name in cases:
        recs = build_chat_recommendations(
            query=query,
            language="ja",
            candidates=candidates,
            birthdate=None,
            flow="A",
        )
        top = recs["recommendations"][0]

        assert expected_tag in recs["_need"]["tags"]
        assert expected_tag in top["breakdown"]["matched_need_tags"]
        assert top["name"] == expected_top_name
        assert top["breakdown"]["score_need"] > 0

        results[expected_tag] = {
            "name": top["name"],
            "score_need": top["breakdown"]["score_need"],
            "matched_need_tags": top["breakdown"]["matched_need_tags"],
        }

    assert results["love"]["name"] != results["career"]["name"]
    assert results["mental"]["name"] != results["money"]["name"]


@pytest.mark.django_db
def test_need_match_by_astro_tags_only(monkeypatch):
    monkeypatch.setattr(chat_mod, "_apply_location_backfill", lambda *args, **kwargs: None)

    candidates = [
        {
            "name": "恋愛神社",
            "lat": 35.0,
            "lng": 139.0,
            "distance_m": 100,
            "goriyaku": "",
            "description": "",
            "astro_tags": ["love"],
            "astro_elements": [],
            "astro_priority": 0,
            "popular_score": 0,
        },
        {
            "name": "仕事神社",
            "lat": 35.1,
            "lng": 139.1,
            "distance_m": 100,
            "goriyaku": "",
            "description": "",
            "astro_tags": ["career"],
            "astro_elements": [],
            "astro_priority": 0,
            "popular_score": 0,
        },
    ]

    recs = build_chat_recommendations(
        query="縁結びで探したい",
        language="ja",
        candidates=candidates,
        birthdate=None,
        flow="A",
    )

    top = recs["recommendations"][0]
    assert top["name"] == "恋愛神社"
    assert "love" in top["breakdown"]["matched_need_tags"]
    assert top["breakdown"]["score_need"] > 0
    assert recs["recommendations"][1]["breakdown"]["score_need"] == 0


@pytest.mark.django_db
def test_need_match_by_text_only(monkeypatch):
    monkeypatch.setattr(chat_mod, "_apply_location_backfill", lambda *args, **kwargs: None)

    candidates = [
        {
            "name": "恋愛神社",
            "lat": 35.0,
            "lng": 139.0,
            "distance_m": 100,
            "goriyaku": "縁結び・恋愛成就・良縁",
            "description": "ご縁で有名",
            "astro_tags": [],
            "astro_elements": [],
            "astro_priority": 0,
            "popular_score": 0,
        },
        {
            "name": "仕事神社",
            "lat": 35.1,
            "lng": 139.1,
            "distance_m": 100,
            "goriyaku": "勝運・開運",
            "description": "静かな境内で知られる",
            "astro_tags": [],
            "astro_elements": [],
            "astro_priority": 0,
            "popular_score": 0,
        },
    ]

    recs = build_chat_recommendations(
        query="近場で縁結び",
        language="ja",
        candidates=candidates,
        birthdate=None,
        flow="A",
    )

    top = recs["recommendations"][0]
    assert top["name"] == "恋愛神社"
    assert "love" in top["breakdown"]["matched_need_tags"]
    assert top["breakdown"]["score_need"] > 0
    assert recs["recommendations"][1]["breakdown"]["score_need"] == 0
