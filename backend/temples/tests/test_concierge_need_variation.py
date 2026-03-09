import pytest

from temples.services.concierge_chat import build_chat_recommendations


@pytest.mark.django_db
def test_need_variation_changes_matched_tags_and_score():
    candidates = [
        {
            "name": "恋愛神社",
            "lat": 35.0,
            "lng": 139.0,
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
            "goriyaku": "仕事運・商売繁盛・開運",
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
            "goriyaku": "金運・財運・商売繁盛",
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

        results[expected_tag] = {
            "name": top["name"],
            "score_need": top["breakdown"]["score_need"],
            "matched_need_tags": top["breakdown"]["matched_need_tags"],
        }

    assert results["love"]["name"] != results["career"]["name"]
    assert results["mental"]["name"] != results["money"]["name"]
