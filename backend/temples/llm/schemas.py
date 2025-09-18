# -*- coding: utf-8 -*-
CONCIERGE_PLAN = {
    "name": "ConciergePlan",
    "schema": {
        "type": "object",
        "properties": {
            "summary": {"type": "string"},
            "shrines": {
                "type": "array",
                "minItems": 1,
                "maxItems": 3,
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "id": {"type": ["integer", "null"]},
                        "place_id": {"type": ["string", "null"]},
                        "reason": {"type": "string"},
                        "distance_m": {"type": "integer"},
                        "duration_min": {"type": "integer"},
                        # 地図マーカー用（任意）
                        "lat": {"type": ["number", "null"]},
                        "lng": {"type": ["number", "null"]},
                        "address": {"type": ["string", "null"]}
                    },
                    "required": ["name", "reason", "distance_m", "duration_min"]
                }
            },
            "tips": {"type": "array", "items": {"type": "string"}}
        },
        "required": ["summary", "shrines", "tips"],
        "additionalProperties": False
    },
    "strict": True
}
