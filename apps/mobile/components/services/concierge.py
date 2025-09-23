# backend/temples/services/concierge.py
import os
from typing import List, TypedDict


class ShrineCandidate(TypedDict):
    name: str
    area_hint: str  # 例: "浅草, 台東区"
    reason: str


class PlanResult(TypedDict):
    mode: str  # "walk" | "car"
    main: ShrineCandidate
    nearby: List[ShrineCandidate]  # 2件


OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

SYSTEM_PROMPT = """あなたは神社コンシェルジュです。
入力（現在地/ご利益/移動手段）から、参拝ルート案を日本語で提案しつつ、
出力は必ずJSONのschemaに従って返すこと。名前は通称でOK、後段でPlace正規化する。"""


def make_plan(current_lat, current_lng, benefit, mode) -> PlanResult:
    # ★ Responses APIに合わせて実装（疑似実装）
    # 実運用では openai SDK の Responses + Structured Outputs を使用
    # ここでは最小のダミーを返し、あとで実APIに差し替え
    return {
        "mode": mode,
        "main": {
            "name": "浅草神社",
            "area_hint": "浅草 台東区",
            "reason": f"{benefit}にご利益で有名",
        },
        "nearby": [
            {
                "name": "浅草寺",
                "area_hint": "浅草 台東区",
                "reason": "メインと同エリアで回遊性高い",
            },
            {"name": "今戸神社", "area_hint": "台東区 近隣", "reason": "縁結びで人気"},
        ],
    }
