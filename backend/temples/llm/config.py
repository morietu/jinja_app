# -*- coding: utf-8 -*-
import os
from dataclasses import dataclass
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")
LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.2"))
LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "800"))
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "")


@dataclass(frozen=True)
class LLMConfig:
    # モデル & 推論挙動
    model: str = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
    temperature: float = float(os.getenv("LLM_TEMPERATURE", "0.2"))
    # SDKが対応していれば使用（未対応なら無視 or コメントアウト）
    max_output_tokens: int = int(os.getenv("LLM_MAX_OUTPUT_TOKENS", "800"))

    # キャッシュ & ログの丸め
    cache_ttl_s: int = int(os.getenv("LLM_CACHE_TTL_S", "600"))  # 10分
    coord_round: int = int(os.getenv("LLM_COORD_ROUND", "3"))    # 小数3桁 ≈ 110m

    # 機能フラグ
    enable_places: bool = os.getenv("LLM_ENABLE_PLACES", "1") != "0"

    # リトライ
    retries: int = int(os.getenv("LLM_RETRIES", "2"))
    backoff_s: float = float(os.getenv("LLM_BACKOFF_S", "0.5"))

    # プロンプトバージョン（回帰検証用）
    prompt_version: str = os.getenv("LLM_PROMPT_VERSION", "v1")

CONFIG = LLMConfig()

def redacted_coords(lat: float, lng: float):
    """ログ用に緯度経度を丸める。"""
    return (round(lat, CONFIG.coord_round), round(lng, CONFIG.coord_round))
