from rest_framework import serializers

class ConciergeRequestSerializer(serializers.Serializer):
    birth_year = serializers.IntegerField(required=True)
