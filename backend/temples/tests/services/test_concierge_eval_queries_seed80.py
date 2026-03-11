from __future__ import annotations

from pathlib import Path

import pytest
import yaml

import temples.services.concierge_chat as chat_mod
from temples.services.concierge_chat import build_chat_recommendations


SEED_PATH = Path(__file__).resolve().parents[2] / "seed" / "representative_shrines.yaml"


SEED80_EVAL_CASES = [
    {
        "id": "seed80_love_001",
        "query": "良縁に恵まれたい",
        "expected_need": "love",
        "expected_top_names": [
            "出雲大社",
            "東京大神宮",
            "気多大社",
            "三光稲荷神社",
            "三嶋大社",
            "伊弉諾神宮",
            "明治神宮",
        ],
        "note": "良縁・縁結び系の代表候補が上位に来ること",
    },
    {
        "id": "seed80_love_002",
        "query": "恋愛成就を願って参拝したい",
        "expected_need": "love",
        "expected_top_names": [
            "東京大神宮",
            "生田神社",
            "恋木神社",
            "三光稲荷神社",
            "三嶋大社",
            "伊弉諾神宮",
            "出雲大社",
        ],
        "note": "恋愛成就・縁結び系の代表候補が上位に来ること",
    },
    {
        "id": "seed80_money_001",
        "query": "金運を上げたい",
        "expected_need": "money",
        "expected_top_names": ["伏見稲荷大社", "今宮戎神社", "西宮神社"],
        "note": "金運系の主力候補が入ること",
    },
    {
        "id": "seed80_money_002",
        "query": "商売繁盛を願いたい",
        "expected_need": "money",
        "expected_top_names": ["伏見稲荷大社", "神田神社（神田明神）", "豊川稲荷"],
        "note": "商売繁盛の王道候補",
    },
    {
        "id": "seed80_career_001",
        "query": "転職を成功させたい",
        "expected_need": "career",
        "expected_top_names": [
            "乃木神社",
            "大山阿夫利神社",
            "妙義神社",
            "猿田彦神社",
            "日枝神社",
        ],
        "note": "転職系では勝運・前進・導きのいずれかが上位に入ること",
    },
    {
        "id": "seed80_career_002",
        "query": "新しい挑戦を後押ししてほしい",
        "expected_need": "career",
        "expected_top_names": ["猿田彦神社", "鶴岡八幡宮", "大山阿夫利神社"],
        "note": "前進・勝運・挑戦",
    },
    {
        "id": "seed80_study_001",
        "query": "受験に向けて学業成就を祈願したい",
        "expected_need": "career",
        "expected_top_names": [
            "太宰府天満宮",
            "北野天満宮",
            "湯島天満宮",
            "猿田彦神社",
            "神田神社（神田明神）",
            "鶴岡八幡宮",
        ],
        "note": "学業系は現行ロジックでは career 扱いで、学問系またはcareer上位候補が入ること",
    },
    {
        "id": "seed80_study_002",
        "query": "資格試験に受かりたい",
        "expected_need": "career",
        "expected_top_names": ["北野天満宮", "湯島天満宮", "大阪天満宮"],
        "note": "資格試験系",
    },
    {
        "id": "seed80_mental_001",
        "query": "厄除けして心を整えたい",
        "expected_need": "mental",
        "expected_top_names": [
            "伊勢神宮（内宮）",
            "出羽三山神社",
            "多賀大社",
            "明治神宮",
            "春日大社",
            "熊野本宮大社",
        ],
        "note": "厄除け・精神安定系の神社が上位に来ること",
    },
    {
        "id": "seed80_mental_002",
        "query": "人生の流れを整えたい",
        "expected_need": "mental",
        "expected_top_names": ["伊勢神宮（内宮）", "大神神社", "熊野本宮大社"],
        "note": "抽象度高めの整流クエリ",
    },
    {
        "id": "seed80_rest_001",
        "query": "静かな場所で心身をリセットしたい",
        "expected_need": "rest",
        "expected_top_names": ["熊野本宮大社", "伊勢神宮（内宮）", "出羽三山神社"],
        "note": "静けさ・再起動",
    },
    {
        "id": "seed80_rest_002",
        "query": "自然の中で穏やかに過ごしたい",
        "expected_need": "rest",
        "expected_top_names": ["伊勢神宮（内宮）", "阿蘇神社", "富士山本宮浅間大社"],
        "note": "自然志向の休息",
    },
]


def _load_seed_candidates() -> list[dict]:
    with SEED_PATH.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or []

    candidates: list[dict] = []
    for i, item in enumerate(data):
        if not isinstance(item, dict):
            continue

        lat = item.get("lat")
        lng = item.get("lng")
        address = (item.get("address") or "").strip()
        name = (item.get("name_jp") or item.get("name") or "").strip()

        if not name or lat is None or lng is None or not address:
            continue

        tags = item.get("astro_tags") or []
        if not isinstance(tags, list):
            tags = []

        candidates.append(
            {
                "id": 10000 + i,
                "shrine_id": 10000 + i,
                "name": name,
                "place_id": f"seed80_{10000 + i}",
                "address": address,
                "formatted_address": address,
                "lat": float(lat),
                "lng": float(lng),
                "distance_m": 1000,
                "goriyaku": item.get("goriyaku") or "",
                "tags": tags,
                "astro_tags": tags,
                "popular_score": 0.5,
            }
        )

    return candidates


@pytest.mark.django_db
@pytest.mark.parametrize("case", SEED80_EVAL_CASES, ids=[c["id"] for c in SEED80_EVAL_CASES])
def test_concierge_eval_queries_seed80(case, monkeypatch):
    monkeypatch.setattr(chat_mod, "_apply_location_backfill", lambda *args, **kwargs: None)

    candidates = _load_seed_candidates()

    recs = build_chat_recommendations(
        query=case["query"],
        language="ja",
        candidates=candidates,
        birthdate=None,
        flow="A",
    )

    assert "recommendations" in recs
    assert len(recs["recommendations"]) > 0

    top_recs = recs["recommendations"][:3]
    top_names = [r["name"] for r in top_recs]

    assert case["expected_need"] in recs["_need"]["tags"]
    assert any(name in case["expected_top_names"] for name in top_names), (
        f"case={case['id']} expected any of {case['expected_top_names']} in top3, "
        f"but got top_names={top_names}"
    )
