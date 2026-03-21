# backend/temples/tests/fixtures/concierge_acceptance_queries.py

CONCIERGE_ACCEPTANCE_QUERIES = [
    {
        "id": "career_push_001",
        "query": "転職が不安。背中を押してほしい。",
        "expected_need": ["career", "mental", "courage"],
        "top1_must_match_any": ["転機", "仕事", "前進", "後押し"],
        "top3_order_rationale": [
            "1位は転機・仕事との一致が最も強いこと",
            "2位は転機との一致はあるが1位より弱いこと",
            "3位は不安ケア寄りで、転機軸は1位より弱いこと",
        ],
        "expected_summary_context_any": ["仕事", "転機", "参拝"],
        "expected_reason_context_any": ["転職", "仕事", "背中を押す", "前進", "後押し"],
    },
    {
        "id": "mental_rest_001",
        "query": "最近疲れていて、落ち着ける神社がいい。",
        "expected_need": ["rest", "mental"],
        "top1_must_match_any": ["落ち着く", "休息", "静か", "心"],
        "top3_order_rationale": [
            "1位は休息・心の安定に直接つながること",
            "2位は近い文脈だが静けさや休息の明示がやや弱いこと",
            "3位は補完候補であること",
        ],
        "expected_summary_context_any": ["休息", "心", "落ち着く", "参拝"],
        "expected_reason_context_any": ["不安", "心", "願いごと", "一致"]
    },
    {
        "id": "money_action_001",
        "query": "金運を上げたい。行動のきっかけがほしい。",
        "expected_need": ["money", "courage"],
        "top1_must_match_any": ["金運", "商売", "開運", "前進"],
        "top3_order_rationale": [
            "1位は金運との一致が中心にあること",
            "2位は開運・前進文脈を持つが金運の直接性で劣ること",
            "3位は補助的な候補であること",
        ],
        "expected_summary_context_any": ["金運", "前向き", "行動", "参拝"],
        "expected_reason_context_any": ["金運", "行動", "きっかけ", "前進", "後押し"],
    },
    {
        "id": "love_001",
        "query": "良いご縁に恵まれたい。恋愛も前向きに進めたい。",
        "expected_need": ["love"],
        "top1_must_match_any": ["縁結び", "恋愛", "良縁"],
        "top3_order_rationale": [
            "1位は恋愛・良縁との一致が明確であること",
            "2位と3位は補完候補であること",
        ],
        "expected_summary_context_any": ["恋愛", "良縁", "ご縁", "参拝"],
        "expected_reason_context_any": ["恋愛", "良縁", "縁結び", "前向き"],
    },
    {
        "id": "study_001",
        "query": "資格試験に受かりたい。集中して勉強を続けたい。",
        "expected_need": ["study"],
        "top1_must_match_any": ["学業", "合格", "試験", "学問"],
        "top3_order_rationale": [
            "1位は学業・合格との一致が中心にあること",
            "2位と3位は学び支援の補完候補であること",
        ],
        "expected_summary_context_any": ["学業", "合格", "試験", "参拝"],
        "expected_reason_context_any": ["資格", "試験", "勉強", "集中", "合格"],
    },
]
