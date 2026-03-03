from rest_framework import serializers
from temples.models import Shrine

class ShrinePublicSerializer(serializers.ModelSerializer):
    lat = serializers.FloatField(source="latitude", required=False, allow_null=True)
    lng = serializers.FloatField(source="longitude", required=False, allow_null=True)

    class Meta:
        model = Shrine
        fields = ["id", "name_jp", "address", "lat", "lng"]
