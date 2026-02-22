# backend/temples/api/views/tags.py
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import serializers
from drf_spectacular.utils import extend_schema

from temples.models import GoriyakuTag

# backend/temples/api/views/tags.py

class GoriyakuTagListItemSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()

@extend_schema(
    operation_id="api_goriyaku_tags_list",
    responses={200: GoriyakuTagListItemSerializer(many=True)},
    tags=["tags"],
)

@api_view(["GET"])
def goriyaku_tags_list(request):
    qs = GoriyakuTag.objects.all().only("id", "name").order_by("id")
    return Response([{"id": t.id, "name": t.name} for t in qs])
