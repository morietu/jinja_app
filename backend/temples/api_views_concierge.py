from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .llm import ConciergeOrchestrator
from .llm.client import PLACEHOLDER

import logging
log = logging.getLogger(__name__)

class ConciergeChatView(APIView):
    throttle_scope = "concierge"

    def post(self, request, *args, **kwargs):
        query = (request.data.get("query") or "").strip()
        candidates = request.data.get("candidates") or []
        if not query:
            return Response({"detail": "query is required"}, status=status.HTTP_400_BAD_REQUEST)

        orch = ConciergeOrchestrator()
        try:
            data = orch.suggest(query=query, candidates=candidates)
            return Response({"ok": True, "data": data}, status=status.HTTP_200_OK)
        except Exception as e:
            # ここで絶対に 500 を返さずフォールバック
            log.exception("concierge chat failed: %s", e)
            return Response(
                {"ok": True, "data": {"raw": PLACEHOLDER["content"]}, "note": "fallback-returned"},
                status=status.HTTP_200_OK,
            )
