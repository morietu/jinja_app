from rest_framework import serializers


class ImportFromPlaceSerializer(serializers.Serializer):
    # Google Places の一部を想定。最低限 name は必須
    name = serializers.CharField(max_length=100)
    address = serializers.CharField(allow_blank=True, required=False, max_length=255)
    lat = serializers.FloatField(required=False, allow_null=True)
    lng = serializers.FloatField(required=False, allow_null=True)
    place_id = serializers.CharField(required=False, allow_blank=True, max_length=255)

    def validate(self, attrs):
        lat = attrs.get("lat")
        lng = attrs.get("lng")
        # lat/lng が片方だけ指定はNG
        if (lat is None) ^ (lng is None):
            raise serializers.ValidationError(
                "lat and lng must be provided together or both omitted."
            )
        # 範囲チェック
        if lat is not None:
            if not (-90.0 <= lat <= 90.0):
                raise serializers.ValidationError("lat out of range [-90, 90].")
        if lng is not None:
            if not (-180.0 <= lng <= 180.0):
                raise serializers.ValidationError("lng out of range [-180, 180].")
        return attrs
