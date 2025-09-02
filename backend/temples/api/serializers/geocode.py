from rest_framework import serializers

class GeocodeResultSerializer(serializers.Serializer):
    lat = serializers.FloatField()
    lon = serializers.FloatField()
    formatted = serializers.CharField()
    precision = serializers.ChoiceField(choices=["rooftop", "street", "city", "region", "approx"])
    provider = serializers.CharField()

class GeocodeResponseSerializer(serializers.Serializer):
    result = GeocodeResultSerializer(required=False)
    candidates = GeocodeResultSerializer(many=True, required=False)
    message = serializers.CharField(required=False)
