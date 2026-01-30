#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml

ROOT = Path(__file__).resolve().parents[1]  # backend/
DEFAULT_SEED = ROOT / "temples" / "seed" / "representative_shrines.yaml"
DEFAULT_OUT = ROOT / "temples" / "fixtures" / "shrines_representative.json"


def _must_str(v: Any, field: str) -> str:
    if not isinstance(v, str) or not v.strip():
        raise ValueError(f"{field} is required and must be non-empty string")
    return v.strip()


def _opt_str(v: Any) -> Optional[str]:
    if v is None:
        return None
    if isinstance(v, str):
        s = v.strip()
        return s if s else None
    return None


def _opt_float(v: Any) -> Optional[float]:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str) and v.strip():
        try:
            return float(v.strip())
        except ValueError:
            return None
    return None


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--seed", type=str, default=str(DEFAULT_SEED), help="seed yaml path")
    p.add_argument("--out", type=str, default=str(DEFAULT_OUT), help="output fixture json path")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    seed_path = Path(args.seed)
    out_path = Path(args.out)

    if not seed_path.exists():
        raise SystemExit(f"seed file not found: {seed_path}")

    raw = yaml.safe_load(seed_path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise SystemExit("seed must be a list of objects")

    now = datetime.now(timezone.utc).isoformat()

    items: List[Dict[str, Any]] = []
    for i, r in enumerate(raw):
        if not isinstance(r, dict):
            raise SystemExit(f"invalid row at index={i}: must be object")

        name_jp = _must_str(r.get("name_jp"), "name_jp")
        goriyaku = _opt_str(r.get("goriyaku")) or ""

        address = _opt_str(r.get("address"))
        lat = _opt_float(r.get("lat"))
        lng = _opt_float(r.get("lng"))
        place_id = _opt_str(r.get("place_id"))

        fields: Dict[str, Any] = {
            "name_jp": name_jp,
            "goriyaku": goriyaku,
            # ✅ loaddata は auto_now を信用できないので明示
            "created_at": now,
            "updated_at": now,
        }
        if address is not None:
            fields["address"] = address
        if lat is not None:
            fields["latitude"] = lat
        if lng is not None:
            fields["longitude"] = lng
        if place_id is not None:
            fields["place_id"] = place_id

        items.append({"model": "temples.shrine", "pk": 100001 + i, "fields": fields})

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[generate_shrines_fixture] wrote {out_path} count={len(items)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
