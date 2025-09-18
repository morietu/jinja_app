# -*- coding: utf-8 -*-
import os
from django.conf import settings
from openai import OpenAI

# Azure を使うならコメントアウト解除
try:
    from openai import AzureOpenAI  # type: ignore
except Exception:
    AzureOpenAI = None  # ライブラリが無ければ未使用扱い

def get_client():
    """
    環境変数で挙動を切替:
      - 公式 OpenAI:      LLM_VENDOR 未設定（または空）かつ LLM_BASE_URL 空
      - 互換プロキシ:     LLM_BASE_URL に http(s)://.../v1 を設定
      - Azure OpenAI:     LLM_VENDOR=azure と AZURE_* を設定
    """
    vendor = os.getenv("LLM_VENDOR", "").lower()
    base_url = (os.getenv("LLM_BASE_URL", "") or "").strip()

     # 遅延 import（未導入なら ImportError に）
    try:
        from openai import OpenAI  # type: ignore
        try:
            from openai import AzureOpenAI  # type: ignore
        except Exception:
            AzureOpenAI = None
    except Exception as e:
        raise ImportError("openai パッケージが見つかりません。pip install openai を実行してください。") from e


    if vendor == "azure":
        if AzureOpenAI is None:
            raise RuntimeError("AzureOpenAI クライアントが利用できません。openai パッケージの対応版をご確認ください。")
        return AzureOpenAI(
            api_key=os.getenv("AZURE_OPENAI_API_KEY") or settings.OPENAI_API_KEY,
            azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
            api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-06-01"),
        )

    # 公式OpenAI or 互換プロキシ
    kwargs = {"api_key": settings.OPENAI_API_KEY or os.getenv("OPENAI_API_KEY")}
    if base_url:
        kwargs["base_url"] = base_url
    return OpenAI(**kwargs)
