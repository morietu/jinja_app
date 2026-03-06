# temples/services/concierge_observability.py
from __future__ import annotations
import json
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger("concierge.observability")


def _top3_snapshot(recs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for r in recs[:3]:
        if not isinstance(r, dict):
            continue

        exp = r.get("explanation") or {}
        reasons = exp.get("reasons") or []
        first_reason_text = None
        if reasons and isinstance(reasons[0], dict):
            first_reason_text = reasons[0].get("text")

        bullets = r.get("bullets") or []
        bullets0 = bullets[0] if isinstance(bullets, list) and bullets else None

        out.append({
            "shrine_id": r.get("shrine_id"),
            "place_id": r.get("place_id"),
            "name": r.get("display_name") or r.get("name"),

            # 本丸
            "reason": r.get("reason"),
            "bullets0": bullets0,
            "ex_summary": exp.get("summary"),
            "ex_reason0": first_reason_text,

            # もし入ってたら見る（後述の reason_source を仕込む用）
            "reason_source": r.get("reason_source"),

            # 既存の補助情報も残すと便利
            "distance_m": r.get("distance_m"),
            "score_total": r.get("_score_total"),
        })
    return out


def concierge_request_summary_log(
    *,
    endpoint: str,  # "chat" or "plan"
    trace_id: str,
    query_len: int,
    flow_requested: Optional[str],
    flow_effective: Optional[str],
    stats: Dict[str, Any],
    recommendations: List[Dict[str, Any]],
) -> None:
    payload = {
        "event": "concierge_result",
        "endpoint": endpoint,
        "trace_id": trace_id,
        "query_len": query_len,
        "flow_requested": flow_requested,
        "flow_effective": flow_effective,
        "result_state": {
            "fallback_mode": stats.get("fallback_mode"),
            "matched_count": stats.get("matched_count"),
            "pool_count": stats.get("pool_count"),
            "displayed_count": stats.get("displayed_count"),
        },
        "top3": _top3_snapshot(recommendations),
    }

    # 1リクエスト1行JSON
    logger.info(json.dumps(payload, ensure_ascii=False))
