# temples/services/concierge.py 今の指示はこれで合ってる？
import os
from typing import TypedDict, List, Literal, Optional, Dict, Any



# --- PlacesService import (robust) ------------------------------------------
# 1) もし本当に PlacesService クラスが用意されていればそれを使う
try:
    from .places import PlacesService as _ImportedPlacesService  # type: ignore[attr-defined]
except Exception:
    _ImportedPlacesService = None

# 2) なければ google_places にクラスがあるか試す（あれば alias）
if _ImportedPlacesService is None:
    try:
        from .google_places import GooglePlacesService as _ImportedPlacesService  # type: ignore[attr-defined]
    except Exception:
        _ImportedPlacesService = None

# 3) それでも無ければ、モジュール関数を包む**薄いアダプタ**を定義
if _ImportedPlacesService is None:
    from . import places as _places_mod

    def _safe_call(func_name: str, **kwargs):
        fn = getattr(_places_mod, func_name, None)
        if fn is None:
            # 想定外でも壊さない：空結果を返して上流で graceful に扱う
            return {"results": []}
        return fn(**kwargs)

    class PlacesService:  # adapter
        def find_place(self, **kwargs):
            return _safe_call("find_place", **kwargs)

        def nearby_search(self, **kwargs):
            return _safe_call("nearby_search", **kwargs)
else:
    # 正規のクラスが見つかったケース
    PlacesService = _ImportedPlacesService
# --- Types --------------------------------------------------------------------
Mode = Literal["walk", "car"]  # UIでは "walk" / "car" を採用（内部で route_hints に合わせて変換）

class ShrineCandidate(TypedDict):
    name: str
    area_hint: str  # 例: "浅草 台東区"
    reason: str

class PlanResult(TypedDict):
    mode: Mode
    main: ShrineCandidate
    nearby: List[ShrineCandidate]  # 2件


# --- AI(ダミー) ---------------------------------------------------------------
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

SYSTEM_PROMPT = """あなたは神社参拝のコンシェルジュです。
入力（現在地/ご利益/移動手段/所要時間）から、参拝ルート案（メイン1＋近隣2）を日本語で考えます。
ただし出力はアプリ側でPlace正規化するため、名称（通称可）・エリア目安・理由の3点だけをJSONで返すこと。
"""

def make_plan_dummy(benefit: str, mode: Mode) -> PlanResult:
    # ★ダミー：まずは画面とAPIを通す
    return {
        "mode": mode,
        "main":   {"name": "浅草神社", "area_hint": "浅草 台東区", "reason": f"{benefit}で人気"},
        "nearby": [
            {"name": "浅草寺",   "area_hint": "浅草 台東区", "reason": "同エリアで回遊しやすい"},
            {"name": "今戸神社", "area_hint": "台東区 近隣", "reason": "縁結びで有名"},
        ],
    }

def make_plan(
    current_lat: Optional[float],
    current_lng: Optional[float],
    benefit: str,
    mode: Mode,
    time_limit: Optional[str] = None
) -> PlanResult:
    """
    将来的に OpenAI Responses API（Structured Outputs）に置き換え。
    OPENAI_API_KEY が無ければダミーで返す。
    """
    if not OPENAI_API_KEY:
        return make_plan_dummy(benefit, mode)

    # ↓将来の本番接続（placeholder）
    # from openai import OpenAI
    # client = OpenAI(api_key=OPENAI_API_KEY)
    # resp = client.responses.create(
    #     model="gpt-4.1-mini",
    #     input=[ ... ],
    #     response_format={"type":"json_object", "schema": ...}
    # )
    # return json.loads(resp.output[0].content[0].text)
    return make_plan_dummy(benefit, mode)


# --- Concierge Service --------------------------------------------------------
class ConciergeService:
    def __init__(self):
        self.places = PlacesService()

    def _route_mode_from_ui(self, mode: Mode) -> Literal["walk", "drive"]:
        """
        ルーティングAPIのモードに合わせて変換。
        UIでは "car" を使うが、ルートヒントは "drive" にする。
        """
        return "walk" if mode == "walk" else "drive"

    def build_plan(
        self,
        *,
        query: str,
        language: str,
        locationbias: str,
        transportation: str
    ) -> Dict[str, Any]:
        """
        Placesの find_place を用いてメイン神社を特定し、
        周辺2件を nearby_search で補完。/api/route/ に渡せる route_hints を返す。
        transportation は UI起点の "walk" | "car" を想定。
        """
        # 1) メイン神社：find_place
        main = self.places.find_place(
            input=query,
            language=language,
            locationbias=locationbias,
            fields=[
                "place_id", "name", "geometry", "formatted_address", "types",
                "photos", "opening_hours", "rating", "user_ratings_total", "icon"
            ],
        )

        if not main or not main.get("results"):
            return {
                "query": query,
                "transportation": transportation,
                "main": None,
                "alternatives": [],
                "route_hints": {"mode": self._route_mode_from_ui(transportation if transportation in ("walk", "car") else "walk"),
                                "waypoints": []},
            }

        main_item = main["results"][0]  # 最上位
        # 整形（バックエンド標準形）
        main_fmt = {
            "place_id": main_item.get("place_id"),
            "name": main_item.get("name"),
            "address": main_item.get("address") or main_item.get("formatted_address"),
            "location": {
                "lat": main_item.get("lat")
                    or (main_item.get("geometry", {}).get("location", {}).get("lat")),
                "lng": main_item.get("lng")
                    or (main_item.get("geometry", {}).get("location", {}).get("lng")),
            },
            "rating": main_item.get("rating"),
            "user_ratings_total": main_item.get("user_ratings_total"),
            "open_now": main_item.get("open_now"),
            "photo_reference": main_item.get("photo_reference"),
            "icon": main_item.get("icon"),
        }

        # 2) 周辺候補：nearby_search（宗教施設系）
        center_lat = main_fmt["location"]["lat"]
        center_lng = main_fmt["location"]["lng"]

        nearby = self.places.nearby_search(
            location=f"{center_lat},{center_lng}",
            radius=1500,
            language=language,
            # Google Places のtypeは1つのみ指定：包括的に place_of_worship
            type="place_of_worship",
        )

        alts: List[Dict[str, Any]] = []
        if nearby and nearby.get("results"):
            # 同一 place_id を除外し、rating降順→距離昇順などの簡易スコア
            items = [r for r in nearby["results"] if r.get("place_id") != main_fmt["place_id"]]
            # distance_m が無い場合もあるのでセーフティに
            def _dist(v: Any) -> float:
                try:
                    return float(v)
                except Exception:
                    return 1e9

            def _rating(v: Any) -> float:
                try:
                    return float(v)
                except Exception:
                    return 0.0

            items.sort(key=lambda r: (-_rating(r.get("rating")), _dist(r.get("distance_m"))))
            for r in items[:2]:
                alts.append({
                    "place_id": r.get("place_id"),
                    "name": r.get("name"),
                    "address": r.get("address") or r.get("vicinity"),
                    "location": {
                        "lat": r.get("lat") or r.get("geometry", {}).get("location", {}).get("lat"),
                        "lng": r.get("lng") or r.get("geometry", {}).get("location", {}).get("lng"),
                    },
                    "rating": r.get("rating"),
                    "user_ratings_total": r.get("user_ratings_total"),
                })

        # 3) ルートヒント（出発地はクライアントが現在地を付与）
        ui_mode: Mode = transportation if transportation in ("walk", "car") else "walk"
        route_mode = self._route_mode_from_ui(ui_mode)

        return {
            "query": query,
            "transportation": ui_mode,  # "walk" | "car"
            "main": main_fmt,
            "alternatives": alts,
            "route_hints": {
                "mode": route_mode,  # "walk" or "drive"
                "waypoints": [{
                    "type": "destination",
                    "place_id": main_fmt["place_id"],
                    "lat": main_fmt["location"]["lat"],
                    "lng": main_fmt["location"]["lng"],
                }],
            },
        }
