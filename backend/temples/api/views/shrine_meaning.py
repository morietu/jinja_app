from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from temples.models import Shrine
from temples.services.plan_service import resolve_plan_context
from temples.services.shrine_meaning_access import shape_shrine_meaning_payload_for_plan
from temples.services.shrine_meaning_composer import compose_shrine_meaning_payload


class ShrineMeaningView(APIView):
    """Return ShrineMeaningPayloadV2 for a shrine detail page.

    Premium entitlement は backend 側で判定する。
    - plan は resolve_plan_context(request) だけを正本とする
    - client から渡された plan 指定（query param / header / body）は一切見ない
    - composer は完全 payload 生成の責務のまま、shaping は access service へ委譲する
    """

    permission_classes = [AllowAny]
    throttle_scope = "shrines"

    def get(self, request, pk: int, *args, **kwargs):
        shrine = Shrine.objects.filter(pk=pk).first()
        if shrine is None:
            return Response({"detail": "not found"}, status=status.HTTP_404_NOT_FOUND)

        # anonymous を 401 にはしない。plan は anonymous / free / premium のいずれかへ解決する。
        plan_context = resolve_plan_context(request)

        try:
            payload = compose_shrine_meaning_payload(shrine)
            shaped_payload = shape_shrine_meaning_payload_for_plan(
                payload,
                plan=plan_context.plan,
            )
        except Exception:
            return Response(
                {"detail": "meaning payload generation failed"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(shaped_payload, status=status.HTTP_200_OK)
