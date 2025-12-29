# temples/api/views/compat.py
import io
import json
from drf_spectacular.utils import extend_schema
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiExample
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response as DRFResponse
from rest_framework.throttling import ScopedRateThrottle

from temples import api_views_concierge as concierge


@extend_schema(
    summary="Concierge chat (compat)",
    description="message もしくは query を受け付ける互換ラッパ",
    request=OpenApiTypes.OBJECT,
    responses={200: OpenApiTypes.OBJECT},
    examples=[
        OpenApiExample(
            "with message",
            value={"message": "神社を教えて", "lat": 35.0, "lng": 139.0},
        ),
        OpenApiExample(
            "with query",
            value={"query": "浅草神社", "lat": 35.71, "lng": 139.80},
        ),
    ],
)
@api_view(["POST"])

def concierge_chat_compat(request):
    """
    ConciergeChat 本実装のレスポンス（ok+data）に
    'reply' を付ける互換ラッパ。
    """
    # ---- 1) raw body 先読み＆パース ----
    try:
        raw = request.body or b"{}"
    except Exception:
        raw = b"{}"
    try:
        parsed = json.loads(raw.decode("utf-8")) if raw else {}
    except Exception:
        parsed = {}

    # ---- 2) message → query に詰め替え（下位互換）----
    msg = (parsed.get("message") or "").strip()
    if msg and not (parsed.get("query") or "").strip():
        parsed["query"] = msg  # ← 下位実装の必須キーを満たす

    # エコー用にテキスト保持
    text = (parsed.get("query") or msg or "").strip()

    # ---- 3) 下位ビューへ渡す HttpRequest を再構成 ----
    #    * _body と _stream を **同じ JSON** に揃えることが重要
    raw2 = json.dumps(parsed, ensure_ascii=False).encode("utf-8")

    dj_req = getattr(request, "_request", request)

    try:
        dj_req.user = getattr(request, "user", None) or getattr(dj_req, "user", None)
        dj_req.auth = getattr(request, "auth", None)
    except Exception:
        pass
    try:
        dj_req._body = raw2
        dj_req._stream = io.BytesIO(raw2)  # None ではなく BytesIO
        dj_req._read_started = False
    except Exception:
        pass

    # ---- 4) 本来の実装に委譲 ----
    resp = concierge.chat(dj_req)

    # ---- 5) HttpResponse は素通し / DRF Response なら 'reply' と 'ok' を付与 ----
    if not isinstance(resp, DRFResponse):
        return resp

    payload = dict(resp.data) if isinstance(resp.data, dict) else {}

    # 200系なのに ok が無い場合は、下位互換のために自動で付ける
    if "ok" not in payload and 200 <= resp.status_code < 300:
        payload["ok"] = True

    # intent 抽出モードでは reply を付けない（JSON固定）
    if text and "intent" not in payload:
        payload.setdefault("reply", f"echo: {text}")
    return DRFResponse(payload, status=resp.status_code)

concierge_chat_compat.throttle_classes = [ScopedRateThrottle]
concierge_chat_compat.throttle_scope = "concierge"
