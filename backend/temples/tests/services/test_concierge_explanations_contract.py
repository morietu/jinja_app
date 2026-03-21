# -*- coding: utf-8 -*-
import copy

from temples.services.concierge_explanations import attach_explanations_for_chat


def test_attach_explanations_keeps_recommendation_contract_fields_and_breakdown():
    recs = {
        "recommendations": [
            {
                "name": "神社A",
                "reason": "仕事運の願いと相性があります。",
                "reason_source": "reason:matched_need_tags",
                "breakdown": {
                    "score_need": 1.2,
                    "score_total": 0.6,
                    "matched_need_tags": ["career"],
                },
                "distance_m": 1200,
                "place_id": "PID_A",
                "popular_score": 7.5,
            },
            {
                "name": "神社B",
                "reason": "心を整えたい相談内容と相性があります。",
                "reason_source": "reason:normalized_original",
                "breakdown": {
                    "score_need": 1.0,
                    "score_total": 0.5,
                    "matched_need_tags": ["mental"],
                },
                "distance_m": 800,
                "place_id": "PID_B",
                "popular_score": 6.0,
            },
        ]
    }
    before = copy.deepcopy(recs["recommendations"])

    out = attach_explanations_for_chat(
        recs,
        query="近場で参拝したい",
        bias={"lat": 35.0, "lng": 139.0, "radius": 8000},
        birthdate=None,
        extra_condition="静か",
    )

    assert "recommendations" in out
    assert len(out["recommendations"]) == len(before)

    for idx, rec in enumerate(out["recommendations"]):
        assert "reason" in rec
        assert "reason_source" in rec
        assert rec["reason"] == before[idx]["reason"]
        assert rec["reason_source"] == before[idx]["reason_source"]
        assert rec["breakdown"] == before[idx]["breakdown"]

        for key, value in before[idx].items():
            assert key in rec
            assert rec[key] == value

        assert "explanation" in rec
        assert rec["explanation"]["version"] == 2
        assert isinstance(rec["explanation"]["summary"], str)
        assert isinstance(rec["explanation"]["reasons"], list)


def test_attach_explanations_chat_uses_primary_need_tag_for_summary_and_reason():
    recs = {
        "recommendations": [
            {
                "name": "神社A",
                "reason": "旧理由",
                "reason_source": "reason:need",
                "_explanation_payload": {
                    "version": 2,
                    "matched_need_tags": ["career"],
                    "highlights": [],
                    "primary_reason": {
                        "type": "need_tag",
                        "label": "career",
                        "label_ja": "転機・仕事",
                        "evidence": ["career"],
                        "score": 2.0,
                        "is_primary": True,
                    },
                    "secondary_reasons": [],
                    "original_reason": "旧理由",
                },
            }
        ]
    }

    out = attach_explanations_for_chat(
        recs,
        query="転職が不安",
        bias=None,
        birthdate=None,
        extra_condition=None,
    )

    rec = out["recommendations"][0]
    exp = rec["explanation"]

    assert exp["version"] == 2
    assert exp["summary"] == "転機・仕事に関わる願いごとと重なる神社です。"
    assert exp["reasons"][0]["code"] == "NEED_MATCH"
    assert exp["reasons"][0]["label"] == "相談との一致"

def test_attach_explanations_chat_uses_element_primary_reason():
    recs = {
        "recommendations": [
            {
                "name": "神社B",
                "reason": "旧理由",
                "reason_source": "reason:compat",
                "_explanation_payload": {
                    "version": 2,
                    "matched_need_tags": [],
                    "highlights": [],
                    "primary_reason": {
                        "type": "element",
                        "label": "element",
                        "label_ja": "生年月日との相性",
                        "evidence": ["score_element:2"],
                        "score": 2.0,
                        "is_primary": True,
                    },
                    "secondary_reasons": [],
                    "original_reason": "旧理由",
                },
            }
        ]
    }

    out = attach_explanations_for_chat(
        recs,
        query="",
        bias=None,
        birthdate="1984-05-15",
        extra_condition=None,
    )

    rec = out["recommendations"][0]
    exp = rec["explanation"]

    assert exp["version"] == 2
    assert exp["summary"] == "生年月日から見た相性を中心におすすめしています。"
    assert exp["reasons"][0]["code"] == "ELEMENT_MATCH"
    assert exp["reasons"][0]["label"] == "生年月日との相性"

def test_attach_explanations_chat_uses_fallback_primary_reason():
    recs = {
        "recommendations": [
            {
                "name": "神社C",
                "reason": "",
                "reason_source": "reason:fallback",
                "_explanation_payload": {
                    "version": 2,
                    "matched_need_tags": [],
                    "highlights": [],
                    "primary_reason": {
                        "type": "fallback",
                        "label": "fallback",
                        "label_ja": "近い候補",
                        "evidence": [],
                        "score": 0.0,
                        "is_primary": True,
                    },
                    "secondary_reasons": [],
                    "original_reason": "",
                },
            }
        ]
    }

    out = attach_explanations_for_chat(
        recs,
        query="近場で参拝したい",
        bias=None,
        birthdate=None,
        extra_condition=None,
    )

    rec = out["recommendations"][0]
    exp = rec["explanation"]

    assert exp["version"] == 2
    assert exp["summary"] == "今の条件に近い候補としておすすめしています。"
    assert exp["reasons"][0]["code"] == "REASON_SOURCE"
