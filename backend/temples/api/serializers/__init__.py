from .favorites import FavoriteSerializer
from rest_framework import serializers
from .models import Shrine

class ShrineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shrine
        fields = ["id", "name_jp", "address", "latitude", "longitude"]  # 必要に応じて拡張
