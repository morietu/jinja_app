from rest_framework import serializers
from temples.models import Shrine  # 実際のモデル名に合わせて

class ShrineRankingSerializer(serializers.ModelSerializer):
    visit_count = serializers.IntegerField()
    favorite_count = serializers.IntegerField()
    popular_score = serializers.FloatField()

    class Meta:
        model = Shrine
        fields = [
            "id",
            "name_jp",
            "address",
            "visit_count",
            "favorite_count",
            "popular_score",
        ]
