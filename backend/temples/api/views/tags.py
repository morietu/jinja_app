# backend/temples/api/views/tags.py
from rest_framework.decorators import api_view
from rest_framework.response import Response

from temples.models import GoriyakuTag

@api_view(["GET"])
def goriyaku_tags_list(request):
    qs = GoriyakuTag.objects.all().only("id", "name").order_by("id")
    return Response([{"id": t.id, "name": t.name} for t in qs])
