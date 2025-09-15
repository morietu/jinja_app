from rest_framework import serializers

class OriginSerializer(serializers.Serializer):
    lat = serializers.FloatField()
    lng = serializers.FloatField()

class ConciergePlanRequestSerializer(serializers.Serializer):
    prompt = serializers.CharField(allow_blank=False, max_length=2000)
    origin = OriginSerializer()
    mode = serializers.ChoiceField(choices=["walking", "driving"])
    count = serializers.IntegerField(min_value=1, max_value=5, default=3)
    radius_m = serializers.IntegerField(min_value=100, max_value=20000, default=2000)

class AiStepSerializer(serializers.Serializer):
    shrine_id = serializers.IntegerField(required=False)
    name = serializers.CharField()
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    address = serializers.CharField(required=False, allow_blank=True)
    reason = serializers.CharField(required=False, allow_blank=True)
    stay_minutes = serializers.IntegerField(required=False, min_value=1)

class AiPlanSerializer(serializers.Serializer):
    title = serializers.CharField()
    summary = serializers.CharField(required=False, allow_blank=True)
    mode = serializers.ChoiceField(choices=["walking", "driving"])
    steps = AiStepSerializer(many=True)
