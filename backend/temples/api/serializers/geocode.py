from rest_framework import serializers


class PointSerializer(serializers.Serializer):
    lat = serializers.FloatField()
    lng = serializers.FloatField()


class GeocodeSearchResponse(serializers.Serializer):
    address = serializers.CharField()
    location = PointSerializer()
    # 必要なら候補リストに
    # candidates = serializers.ListField(child=AddressCandidateSerializer())


class GeocodeReverseResponse(serializers.Serializer):
    address = serializers.CharField()
    location = PointSerializer()


class SearchQuerySerializer(serializers.Serializer):
    q = serializers.CharField(max_length=200)
    limit = serializers.IntegerField(min_value=1, max_value=20, required=False, default=5)
    lang = serializers.CharField(required=False, default="ja")


class GeocodeItemSerializer(serializers.Serializer):
    place_id = serializers.CharField()
    name = serializers.CharField(allow_null=True)
    lat = serializers.FloatField()
    lng = serializers.FloatField()
    address = serializers.DictField(child=serializers.CharField(), required=False)
    type = serializers.CharField(required=False, allow_blank=True)
    class_ = serializers.CharField(source="class", required=False, allow_blank=True)


class SearchResponseSerializer(serializers.Serializer):
    items = GeocodeItemSerializer(many=True)
    cached = serializers.BooleanField()
    provider = serializers.CharField()


class ReverseQuerySerializer(serializers.Serializer):
    lat = serializers.FloatField(min_value=-90, max_value=90)
    lng = serializers.FloatField(min_value=-180, max_value=180)
    lang = serializers.CharField(required=False, default="ja")


class ReverseResponseSerializer(serializers.Serializer):
    item = GeocodeItemSerializer(allow_null=True)
    cached = serializers.BooleanField()
    provider = serializers.CharField()
