import traceback
from temples.llm.orchestrator import chat_to_plan
from temples.llm.backfill import fill_locations, _shorten_japanese_address as S

payload = {
    "query": "縁結び 徒歩",
    "area": "港区赤坂",
    "candidates": [{"name": "赤坂氷川神社"}],
}

try:
    print("Running simple debug for concierge pipeline")
    llm_out = (
        chat_to_plan(payload["query"], candidates=payload["candidates"], area=payload.get("area"))
        or {}
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
    area = payload.get("area")
    if area and recs:
        try:
            short = S(area)
        except Exception:
            short = area
        if isinstance(recs[0], dict):
            recs[0] = {**recs[0], "location": short}
    print("Recs after area shorten:", recs)
    filled = (
        fill_locations({"recommendations": recs}, candidates=recs, bias=None, shorten=True) or {}
    )
    print("Filled result:", filled)
    final_recs = filled.get("recommendations") or recs
    print("Final recs:", final_recs)
except Exception:
    traceback.print_exc()

print("Done")
