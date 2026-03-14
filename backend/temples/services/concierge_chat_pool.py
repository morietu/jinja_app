from __future__ import annotations

from typing import Any, Dict, List, Optional

from temples.services.concierge_candidate_utils import _normalize_candidate_fields


def _seed_recs_from_candidates(
    candidates: Optional[List[Dict[str, Any]]],
    size: int = 12,
) -> Dict[str, Any]:
    safe_candidates = [
        _normalize_candidate_fields(c)
        for c in (candidates or [])
        if isinstance(c, dict)
    ]
    return {
        "recommendations": safe_candidates[:size],
        "_seed": True,
    }


def _ensure_pool_size(
    recs: Dict[str, Any],
    *,
    candidates: List[Dict[str, Any]],
    size: int = 12,
) -> Dict[str, Any]:
    current: List[Dict[str, Any]] = [
        _normalize_candidate_fields(r)
        for r in (recs.get("recommendations") or [])
        if isinstance(r, dict)
    ]
    safe_candidates = [
        _normalize_candidate_fields(c)
        for c in candidates
        if isinstance(c, dict)
    ]

    seen_ids = set()
    seen_names = set()

    for r in current:
        rid = r.get("shrine_id") or r.get("id")
        if rid is not None:
            seen_ids.add(rid)

        name = str(r.get("name") or "").strip()
        if name:
            seen_names.add(name)

    for cand in safe_candidates:
        if len(current) >= size:
            break

        cid = cand.get("shrine_id") or cand.get("id")
        cname = str(cand.get("name") or "").strip()

        if cid is not None and cid in seen_ids:
            continue
        if cname and cname in seen_names:
            continue

        current.append(cand)

        if cid is not None:
            seen_ids.add(cid)
        if cname:
            seen_names.add(cname)

    out = dict(recs)
    out["recommendations"] = current
    return out


def _merge_candidate_fields(
    recs: Dict[str, Any],
    *,
    candidates: List[Dict[str, Any]],
) -> Dict[str, Any]:
    safe_candidates = [
        _normalize_candidate_fields(c)
        for c in candidates
        if isinstance(c, dict)
    ]

    by_id: Dict[Any, Dict[str, Any]] = {}
    by_name: Dict[str, Dict[str, Any]] = {}

    for c in safe_candidates:
        cid = c.get("shrine_id") or c.get("id")
        if cid is not None:
            by_id[cid] = c

        name = str(c.get("name") or "").strip()
        if name:
            by_name[name] = c

    merged: List[Dict[str, Any]] = []

    for r in recs.get("recommendations") or []:
        if not isinstance(r, dict):
            continue

        row_input = _normalize_candidate_fields(r)
        base = None

        rid = row_input.get("shrine_id") or row_input.get("id")
        if rid is not None:
            base = by_id.get(rid)

        if base is None:
            name = str(row_input.get("name") or "").strip()
            if name:
                base = by_name.get(name)

        if base is not None:
            row = dict(base)
            row.update(row_input)  # orchestrator 側の reason などを優先
            merged.append(row)
        else:
            merged.append(row_input)

    out = dict(recs)
    out["recommendations"] = merged
    return out
