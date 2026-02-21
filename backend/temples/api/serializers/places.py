from rest_framework import serializers


class PlaceItemSerializer(serializers.Serializer):
    place_id = serializers.CharField()
    name = serializers.CharField(allow_null=True, required=False)
    address = serializers.CharField(allow_null=True, required=False)
    lat = serializers.FloatField(allow_null=True, required=False)
    lng = serializers.FloatField(allow_null=True, required=False)
    types = serializers.ListField(child=serializers.CharField(), required=False)


class PlacesSearchResponse(serializers.Serializer):
    results = PlaceItemSerializer(many=True, required=False)
    cached = serializers.BooleanField(required=False)
    provider = serializers.CharField(required=False)

    # 互換が必要なら残す（不要なら消す）
    items = PlaceItemSerializer(many=True, required=False)


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
    url = serializers.CharField(required=False)


class PlaceLiteSerializer(serializers.Serializer):
    place_id = serializers.CharField()
    name = serializers.CharField(allow_blank=True, required=False)
    address = serializers.CharField(allow_null=True, required=False)
    lat = serializers.FloatField(allow_null=True, required=False)
    lng = serializers.FloatField(allow_null=True, required=False)
    types = serializers.ListField(child=serializers.CharField(), required=False)


class PlaceLiteResponseSerializer(serializers.Serializer):
    results = PlaceLiteSerializer(many=True)
