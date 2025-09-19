from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .llm import ConciergeOrchestrator

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
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response({"ok": True, "data": data}, status=status.HTTP_200_OK)
