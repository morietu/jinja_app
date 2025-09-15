import os
from typing import Any, Dict, Optional

try:
    from openai import OpenAI  # pip install openai>=1.30
    from pydantic import BaseModel, Field, ValidationError, conint, confloat  # pip install pydantic>=2
except Exception:
    OpenAI = None  # type: ignore

    # 最低限のダミー（未導入時でも import エラーを避ける）
    class ValidationError(Exception): ...
    class BaseModel:
        @classmethod
        def model_json_schema(cls): return {}
        @classmethod
        def model_validate(cls, data): return data
        def model_dump(self): return {}

    def conint(**kwargs): return int     # type: ignore
    def confloat(**kwargs): return float # type: ignore


class AiStepModel(BaseModel):
    shrine_id: Optional[int] = None
    name: str
    latitude: confloat(ge=-90, le=90)      # type: ignore
    longitude: confloat(ge=-180, le=180)   # type: ignore
    address: Optional[str] = ""
    reason: Optional[str] = ""
    stay_minutes: Optional[conint(ge=1)] = None  # type: ignore

class AiPlanModel(BaseModel):
    title: str
    summary: Optional[str] = ""
    mode: str  # "walking" | "driving"
    steps: list[AiStepModel]

_SYSTEM_PROMPT = (
    "あなたは旅のコンシェルジュです。ユーザーの希望に沿って、"
    "順番付きの神社参拝プラン（最大5件）を日本語で考えます。"
    "必ず指定のJSONスキーマに適合する応答のみを返してください。"
)

_client_cache = None

def _get_openai_client():
    global _client_cache
    if OpenAI is None:
        return None
    if _client_cache is None:
        _client_cache = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    return _client_cache

def build_ai_plan_or_none(
    prompt: str,
    origin: Dict[str, float],
    mode: str,
    count: int,
    radius_m: int,
) -> Optional[Dict[str, Any]]:
    """
    OpenAI Responses API（Structured Outputs）で行程案を生成。
    失敗/未設定なら None を返す（呼び出し側でフォールバック）。
    """
    client = _get_openai_client()
    if client is None:
        return None

    try:
        result = client.responses.create(
            model="gpt-4o-mini",
            system=_SYSTEM_PROMPT,
            input=[
                {"role": "user", "content": [
                    {"type": "text", "text": f"起点: lat={origin['lat']}, lng={origin['lng']}"},
                    {"type": "text", "text": f"移動手段: {mode}, 希望件数: {count}, 半径: {radius_m}m"},
                    {"type": "text", "text": f"ユーザー要望: {prompt}"},
                ]}
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "AiPlanModel",
                    "schema": AiPlanModel.model_json_schema(),
                    "strict": True,
                },
            },
            temperature=0.3,
        )

        # SDK の出力形はバージョン差があります。parsed 優先、無ければ text 。
        data = None
        try:
            msg = result.output[0].content[0]
            data = getattr(msg, "parsed", None) or getattr(msg, "text", None)
        except Exception:
            data = None
        if not data:
            return None

        # スキーマ再検証（型崩れを防止）
        plan = AiPlanModel.model_validate(data)
        return plan.model_dump() if hasattr(plan, "model_dump") else data

    except (ValidationError, Exception):
        return None
