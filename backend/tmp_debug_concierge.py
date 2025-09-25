import os
import django
import json

# Setup Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "shrine_project.settings")
django.setup()

from temples.api_views import ConciergePlanView
from temples.llm.orchestrator import chat_to_plan
from temples.llm.backfill import fill_locations, _shorten_japanese_address as S

# Simulate the payload used in the test
payload = {
    "query": "縁結び 徒歩",
    "area": "港区赤坂",
    "candidates": [{"name": "赤坂氷川神社"}],
}

print("Running local debug for concierge pipeline")

# Call chat_to_plan
llm_out = (
    chat_to_plan(payload["query"], candidates=payload["candidates"], area=payload.get("area")) or {}
)
print("LLM OUT:", llm_out)

recs = list(llm_out.get("recommendations") or [])
print("Initial recs after LLM:", recs)

if not recs:
    if payload.get("candidates"):
        first_name = payload["candidates"][0].get("name") or "近隣の神社"
        recs = [{"name": first_name, "reason": "暫定"}]
    else:
        recs = [{"name": "近隣の神社", "reason": "暫定"}]

print("Recs after fallback/candidates:", recs)

# Shorten area
area = payload.get("area")
if area and recs:
    try:
        short = S(area)
    except Exception:
        short = area
    if isinstance(recs[0], dict):
        recs[0] = {**recs[0], "location": short}

print("Recs after area shorten:", recs)

# Backfill
filled = fill_locations({"recommendations": recs}, candidates=recs, bias=None, shorten=True) or {}
print("Filled result:", filled)

final_recs = filled.get("recommendations") or recs
print("Final recs:", final_recs)

print("Done")
