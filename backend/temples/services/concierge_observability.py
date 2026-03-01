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
        codes = [
            str(x.get("code"))
            for x in reasons
            if isinstance(x, dict) and x.get("code") is not None
        ]
        out.append({
            "name": r.get("display_name") or r.get("name"),
            "distance_m": r.get("distance_m"),
            "score_total": r.get("_score_total"),
            "reason_codes": codes,
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
