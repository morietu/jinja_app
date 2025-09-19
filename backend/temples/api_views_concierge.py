from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from .llm import ConciergeOrchestrator
from .llm.client import PLACEHOLDER

import logging
log = logging.getLogger(__name__)

class ConciergeChatView(APIView):
    throttle_scope = "concierge"
    # ← 重要: セッション認証を無効化して CSRF を回避
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        query = (request.data.get("query") or "").strip()
        candidates = request.data.get("candidates") or []
        if not query:
            return Response({"detail": "query is required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            data = ConciergeOrchestrator().suggest(query=query, candidates=candidates)
            return Response({"ok": True, "data": data}, status=status.HTTP_200_OK)
        except Exception as e:
            log.exception("concierge chat failed: %s", e)
            return Response({"ok": True, "data": {"raw": PLACEHOLDER["content"]}, "note": "fallback-returned"},
                            status=status.HTTP_200_OK)
