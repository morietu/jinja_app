# backend/temples/recommendation/llm_adapter.py
from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from typing import Any, Protocol, runtime_checkable

try:
    # オプショナル依存（LLM_PROVIDER=openaiのときだけ必要）
    import openai  # type: ignore
except Exception:  # pragma: no cover
    openai = None


@runtime_checkable
class LLMAdapter(Protocol):
    """Concierge 用の薄い LLM インターフェース。"""

    def parse_query(self, text: str) -> dict:
        """自然文を構造化に。失敗時は {} を返すこと。"""
        ...

    def backfill_strategy(self, context: dict) -> dict:
        """
        結果が薄い場合の拡張方針（半径拡大など）を返す。
        例: {"radius_km_add": 5, "kind": "all"} / 空 dict で無変更。
        """
        ...

    def summarize(self, shrines: list[dict], user_ctx: dict | None = None) -> list[str]:
        """
        Top-N の各候補に短い“推しポイント”を付与。
        入力は DB 由来のフィールドのみを渡すこと（幻影対策）。
        要素数は len(shrines) に合わせる。
        """
        ...


@dataclass
class NullAdapter:
    """フォールバック（LLMを使わない）。常に安全。"""

    def parse_query(self, text: str) -> dict:
        return {}

    def backfill_strategy(self, context: dict) -> dict:
        return {}

    def summarize(self, shrines: list[dict], user_ctx: dict | None = None) -> list[str]:
        return [""] * len(shrines)


@dataclass
class OpenAIAdapter:
    """
    OpenAI などの実装例。
    - 依存: openai パッケージ（provider 選択時のみ必要）
    - タイムアウト/失敗時は安全にフォールバック
    """

    model: str
    timeout_ms: int
    prompts_dir: str
    temperature: float = 0.2
    max_tokens: int = 800
    base_url: str | None = None
    force_chat: bool = True
    force_json: bool = True
    retries: int = 2
    backoff_s: float = 0.5

    def _read_prompt(self, name: str) -> str:
        """prompts/{name}.txt を読む。無ければ安全な既定文にフォールバック。"""
        path = os.path.join(self.prompts_dir, f"{name}.txt")
        try:
            with open(path, "r", encoding="utf-8") as f:
                return f.read()
        except FileNotFoundError:
            # CI / 初期導入向けの超簡易プロンプト（安全側）
            if name == "parse_query":
                return (
                    "You output a compact JSON. Keys allowed: "
                    "area, radius_km, kyusei, deity, kind, goriyaku, q. "
                    "If unsure, return {}."
                )
            if name == "backfill":
                return (
                    "You output JSON with optional keys: radius_km_add, kind, area_bias, notes. "
                    "Use small increments. If not needed, return {}."
                )
            if name == "summarize":
                return (
                    "Given a JSON with 'shrines' list, return a JSON array of short strings, "
                    "one per shrine. If you can't, return []."
                )
            # どれにも該当しなければ空返し
            return ""

    def _client(self):
        if openai is None:
            return None
        if hasattr(openai, "OpenAI"):
            kwargs = {}
            if self.base_url:
                kwargs["base_url"] = self.base_url
            return openai.OpenAI(**kwargs)  # type: ignore
        return openai  # 旧SDK互換

    def _chat_once(
        self, client, system_prompt: str, user_prompt: str, *, force_json_object: bool
    ) -> str:
        if client is None:
            return ""
        try:
            resp = client.chat.completions.create(  # type: ignore[attr-defined]
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                timeout=self.timeout_ms / 1000.0,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                # summarize は配列を返すので json_object を強制しない
                response_format=(
                    {"type": "json_object"}
                    if (self.force_json and force_json_object and hasattr(client, "chat"))
                    else None
                ),
            )

            content = resp.choices[0].message.content or ""
            return content.strip()
        except Exception:
            return ""

    def _chat(self, system_prompt: str, user_prompt: str, *, force_json_object: bool = True) -> str:
        """リトライ／バックオフ込みの共通呼び出し。_chat_once を使う。"""
        client = self._client()
        out = ""
        for attempt in range(max(0, self.retries) + 1):
            out = self._chat_once(
                client, system_prompt, user_prompt, force_json_object=force_json_object
            )
            if out:
                break
            try:
                time.sleep(self.backoff_s * (2**attempt))
            except Exception:
                pass
        return out

    # -------- public API --------
    def parse_query(self, text: str) -> dict:
        sys_p = self._read_prompt("parse_query")
        user_p = text.strip()
        out = self._chat(sys_p, user_p, force_json_object=True)
        try:
            data = json.loads(out)
            if isinstance(data, dict):
                # 期待キーのみを抜く（安全側）
                allow = {"area", "radius_km", "kyusei", "deity", "kind", "goriyaku", "q"}
                return {k: v for k, v in data.items() if k in allow and v not in (None, "")}
        except Exception:
            pass
        return {}

    def backfill_strategy(self, context: dict) -> dict:
        sys_p = self._read_prompt("backfill")
        user_p = json.dumps(context, ensure_ascii=False)
        out = self._chat(sys_p, user_p, force_json_object=True)
        try:
            data = json.loads(out)
            if isinstance(data, dict):
                allow = {"radius_km_add", "kind", "area_bias", "notes"}
                return {k: v for k, v in data.items() if k in allow and v not in (None, "")}
        except Exception:
            pass
        return {}

    def summarize(self, shrines: list[dict], user_ctx: dict | None = None) -> list[str]:
        sys_p = self._read_prompt("summarize")
        payload = {"shrines": shrines, "user": user_ctx or {}}
        # ← ここは配列を返すので json_object を強制しない
        out = self._chat(sys_p, json.dumps(payload, ensure_ascii=False), force_json_object=False)

        try:
            data = json.loads(out)
            if isinstance(data, list):
                # 長さを合わせる（不足は空文字で埋める、過剰は切る）
                data = [str(x) for x in data]
                if len(data) < len(shrines):
                    data += [""] * (len(shrines) - len(data))
                return data[: len(shrines)]
        except Exception:
            pass
        return [""] * len(shrines)


def get_llm_adapter(
    provider: str | None,
    model: str | None,
    timeout_ms: int,
    prompts_dir: str,
    enabled: bool,
    **kwargs: Any,
) -> LLMAdapter:
    """
    Feature flag を見て適切な Adapter を返す。
    - enabled=False → NullAdapter
    - provider を見て適切な実装へ
    """
    if not enabled:
        return NullAdapter()

    if (provider or "").lower() == "openai":
        return OpenAIAdapter(
            model=model or "gpt-4o-mini",
            timeout_ms=timeout_ms,
            prompts_dir=prompts_dir,
            temperature=kwargs.get("temperature", 0.2),
            max_tokens=kwargs.get("max_tokens", 800),
            base_url=kwargs.get("base_url"),
            force_chat=kwargs.get("force_chat", True),
            force_json=kwargs.get("force_json", True),
            retries=kwargs.get("retries", 2),
            backoff_s=kwargs.get("backoff_s", 0.5),
        )
    return NullAdapter()
