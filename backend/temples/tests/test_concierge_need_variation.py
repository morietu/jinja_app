import pytest

from temples.services.concierge_chat import build_chat_recommendations




@pytest.mark.django_db
def test_need_variation_changes_matched_tags_and_score(monkeypatch):
    

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
            bias=None,
            birthdate=None,
            goriyaku_tag_ids=None,
            extra_condition=None,
            public_mode="need",
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
        bias=None,
        birthdate=None,
        goriyaku_tag_ids=None,
        extra_condition=None,
        public_mode="need",
        flow="A",
    )

    top = recs["recommendations"][0]
    assert top["name"] == "恋愛神社"
    assert "love" in top["breakdown"]["matched_need_tags"]
    assert top["breakdown"]["score_need"] > 0
    assert recs["recommendations"][1]["breakdown"]["score_need"] == 0


@pytest.mark.django_db
def test_need_match_by_text_only(monkeypatch):
    

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
        bias=None,
        birthdate=None,
        goriyaku_tag_ids=None,
        extra_condition=None,
        public_mode="need",
        flow="A",
    )

    top = recs["recommendations"][0]
    assert top["name"] == "恋愛神社"
    assert "love" in top["breakdown"]["matched_need_tags"]
    assert top["breakdown"]["score_need"] > 0
    assert recs["recommendations"][1]["breakdown"]["score_need"] == 0


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("query", "expected_tag"),
    [
        ("開運祈願したい", "courage"),
        ("開運したい", "courage"),
        ("運を開きたい", "courage"),
        ("背中を押してほしい", "courage"),
    ],
)
def test_open_luck_queries_resolve_to_courage(query, expected_tag):
    candidates = [
        {
            "name": "前進神社",
            "lat": 35.0,
            "lng": 139.0,
            "distance_m": 100,
            "goriyaku": "開運・勝運・心願成就",
            "description": "一歩踏み出したい時に知られる",
            "astro_tags": ["courage"],
            "astro_elements": [],
            "astro_priority": 0,
            "popular_score": 5,
        },
        {
            "name": "休息神社",
            "lat": 35.1,
            "lng": 139.1,
            "distance_m": 100,
            "goriyaku": "癒し・静寂",
            "description": "静かに休める",
            "astro_tags": ["rest"],
            "astro_elements": [],
            "astro_priority": 0,
            "popular_score": 5,
        },
    ]

    recs = build_chat_recommendations(
        query=query,
        language="ja",
        candidates=candidates,
        bias=None,
        birthdate=None,
        goriyaku_tag_ids=None,
        extra_condition=None,
        public_mode="need",
        flow="A",
    )

    top = recs["recommendations"][0]
    summary = ((top.get("explanation") or {}).get("summary")) or ""
    reasons = ((top.get("explanation") or {}).get("reasons")) or []
    first_reason_text = str(reasons[0].get("text") if reasons else "")

    assert expected_tag in recs["_need"]["tags"]
    assert expected_tag in top["breakdown"]["matched_need_tags"]
    assert top["reason_source"] == "reason:matched_need_tags"
    assert (
        "前進" in summary
        or "後押し" in summary
        or "前向き" in summary
        or "前進" in first_reason_text
        or "後押し" in first_reason_text
    )


@pytest.mark.django_db
def test_courage_need_explanation_uses_japanese_label():
    candidates = [
        {
            "name": "前進神社",
            "lat": 35.0,
            "lng": 139.0,
            "distance_m": 100,
            "goriyaku": "開運・勝運・心願成就",
            "description": "一歩踏み出したい時に知られる",
            "astro_tags": ["courage"],
            "astro_elements": [],
            "astro_priority": 0,
            "popular_score": 5,
        },
    ]

    recs = build_chat_recommendations(
        query="背中を押してほしい",
        language="ja",
        candidates=candidates,
        bias=None,
        birthdate=None,
        goriyaku_tag_ids=None,
        extra_condition=None,
        public_mode="need",
        flow="A",
    )

    top = recs["recommendations"][0]
    reasons = (top.get("explanation") or {}).get("reasons") or []

    assert any(r.get("code") == "NEED_MATCH" for r in reasons)
    assert all("courage" not in str(r.get("text") or "") for r in reasons)

@pytest.mark.django_db
def test_flow_better_query_prefers_courage_over_career():
    candidates = [
        {
            "name": "前進神社",
            "lat": 35.0,
            "lng": 139.0,
            "distance_m": 100,
            "goriyaku": "開運・勝運",
            "description": "前向きな変化を後押しする",
            "astro_tags": ["courage"],
            "astro_elements": [],
            "astro_priority": 0,
            "popular_score": 5,
        },
        {
            "name": "仕事神社",
            "lat": 35.1,
            "lng": 139.1,
            "distance_m": 100,
            "goriyaku": "仕事運・昇進",
            "description": "仕事運で知られる",
            "astro_tags": ["career"],
            "astro_elements": [],
            "astro_priority": 0,
            "popular_score": 5,
        },
    ]

    recs = build_chat_recommendations(
        query="流れを良くしたい",
        language="ja",
        candidates=candidates,
        bias=None,
        birthdate=None,
        goriyaku_tag_ids=None,
        extra_condition=None,
        public_mode="need",
        flow="A",
    )

    assert "courage" in recs["_need"]["tags"]

@pytest.mark.django_db
def test_tired_and_calm_query_resolves_to_rest_and_mental():
    candidates = [
        {
            "name": "整心神社",
            "lat": 35.0,
            "lng": 139.0,
            "distance_m": 100,
            "goriyaku": "厄除け・心願成就",
            "description": "静かな環境で心身を整えたい人に向く",
            "astro_tags": ["mental", "rest"],
            "astro_elements": [],
            "astro_priority": 0,
            "popular_score": 5,
        },
        {
            "name": "休息神社",
            "lat": 35.1,
            "lng": 139.1,
            "distance_m": 100,
            "goriyaku": "癒し・休息",
            "description": "静かに休める",
            "astro_tags": ["rest"],
            "astro_elements": [],
            "astro_priority": 0,
            "popular_score": 5,
        },
    ]

    recs = build_chat_recommendations(
        query="最近疲れていて、落ち着ける神社がいい。",
        language="ja",
        candidates=candidates,
        bias=None,
        birthdate=None,
        goriyaku_tag_ids=None,
        extra_condition=None,
        public_mode="need",
        flow="A",
    )

    tags = recs.get("_need", {}).get("tags", [])
    assert "rest" in tags
    assert "mental" in tags

    top = recs["recommendations"][0]
    assert "rest" in top["breakdown"]["matched_need_tags"]
    assert "mental" in top["breakdown"]["matched_need_tags"]

@pytest.mark.django_db
def test_money_and_action_query_resolves_to_money_and_courage():
    candidates = [
        {
            "name": "金運前進神社",
            "lat": 35.0,
            "lng": 139.0,
            "distance_m": 100,
            "goriyaku": "商売繁盛・開運・勝運",
            "description": "前向きな行動のきっかけを後押しする",
            "astro_tags": ["money", "courage"],
            "astro_elements": [],
            "astro_priority": 0,
            "popular_score": 5,
        },
        {
            "name": "金運神社",
            "lat": 35.1,
            "lng": 139.1,
            "distance_m": 100,
            "goriyaku": "商売繁盛・金運",
            "description": "金運で知られる",
            "astro_tags": ["money"],
            "astro_elements": [],
            "astro_priority": 0,
            "popular_score": 5,
        },
    ]

    recs = build_chat_recommendations(
        query="金運を上げたい。行動のきっかけがほしい。",
        language="ja",
        candidates=candidates,
        bias=None,
        birthdate=None,
        goriyaku_tag_ids=None,
        extra_condition=None,
        public_mode="need",
        flow="A",
    )

    tags = recs.get("_need", {}).get("tags", [])
    assert "money" in tags
    assert "courage" in tags
