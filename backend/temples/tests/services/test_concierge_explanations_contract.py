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
