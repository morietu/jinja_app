import os
import traceback

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "shrine_project.settings")
django.setup()

from temples.api_views_concierge import _build_bias, _enrich_candidates_with_places, _parse_radius
from temples.llm import backfill as bf
from temples.llm.backfill import fill_locations

payload = {
    "query": "縁結び 徒歩",
    "area": "港区赤坂",
    "candidates": [{"name": "赤坂氷川神社"}],
}

try:
    print("=== start debug concierge flow ===")
    bias = _build_bias(payload)
    print("bias:", bias)

    # fake orchestrator suggest (as in conftest)
    llm_recs = {
        "recommendations": [
            {
                "id": "PID_AKASAKA",
                "name": "赤坂氷川神社",
                "formatted_address": "東京都港区赤坂6-10-12",
                "reason": "dummy",
            }
        ]
    }
    print("llm_recs:", llm_recs)

    # Step 2: lookup address for each rec if not location
    for rec in llm_recs.get("recommendations", []):
        if not rec.get("location"):
            addr = None
            try:
                addr = bf._lookup_address_by_name(rec.get("name") or "", bias=bias, lang="ja")
            except Exception:
                addr = None
            print("lookup addr for rec:", addr)
            if addr:
                short = bf._shorten_japanese_address(addr)
                if short:
                    rec["location"] = short
    print("after lookup on recs:", llm_recs)

    # Step 3: enrich candidates
    enriched_candidates = _enrich_candidates_with_places(
        payload.get("candidates"),
        lat=(bias or {}).get("lat"),
        lng=(bias or {}).get("lng"),
        area=payload.get("area"),
    )
    print("enriched_candidates:", enriched_candidates)

    # Step 4: fill_locations
    filled = fill_locations(llm_recs, candidates=enriched_candidates, bias=bias, shorten=True)
    print("filled:", filled)

    print("final recommendations:", filled.get("recommendations"))

except Exception:
    traceback.print_exc()

print("=== done ===")
