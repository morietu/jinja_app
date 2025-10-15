from rest_framework import serializers


class PlaceItemSerializer(serializers.Serializer):
    place_id = serializers.CharField()
    name = serializers.CharField(allow_null=True, required=False)
    lat = serializers.FloatField(required=False)
    lng = serializers.FloatField(required=False)
    address = serializers.DictField(child=serializers.CharField(), required=False)
    types = serializers.ListField(child=serializers.CharField(), required=False)


class PlacesSearchResponse(serializers.Serializer):
    items = PlaceItemSerializer(many=True, required=False)
    results = serializers.ListField(child=PlaceItemSerializer(), required=False)
    cached = serializers.BooleanField(required=False)
    provider = serializers.CharField(required=False)


class TextSearchResponse(PlacesSearchResponse):
    pass


class NearbySearchResponse(PlacesSearchResponse):
    pass


class PlaceDetailResponse(serializers.Serializer):
    place_id = serializers.CharField()
    name = serializers.CharField(allow_null=True, required=False)
    address = serializers.CharField(allow_null=True, required=False)
    rating = serializers.FloatField(allow_null=True, required=False)
    user_ratings_total = serializers.IntegerField(allow_null=True, required=False)
    types = serializers.ListField(child=serializers.CharField(), required=False)
    location = serializers.DictField(child=serializers.FloatField(), required=False)
    photo_reference = serializers.CharField(required=False, allow_blank=True)


class PlacePhotoResponse(serializers.Serializer):
    # 画像をURLで返す場合は url を、バイナリを返すなら OpenApiTypes.BINARY を付ける（後述）
    url = serializers.CharField(required=False)
