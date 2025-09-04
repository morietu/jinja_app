from rest_framework import serializers
from .models import Shrine, Favorite

class ShrineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shrine
        fields = ["id", "name_jp", "address", "latitude", "longitude"]

class FavoriteSerializer(serializers.ModelSerializer):
    shrine = ShrineSerializer(read_only=True)
    shrine_id = serializers.PrimaryKeyRelatedField(
        queryset=Shrine.objects.all(),
        source="shrine",
        write_only=True
    )

    class Meta:
        model = Favorite
        fields = ["id", "shrine", "shrine_id", "created_at"]
        read_only_fields = ["id", "created_at"]
