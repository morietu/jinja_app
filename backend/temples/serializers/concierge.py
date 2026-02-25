# backend/temples/serializers/concierge.py
from rest_framework import serializers


class ShrineRecommendationSerializer(serializers.Serializer):
    name = serializers.CharField()
    location = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    note = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class LocationSerializer(serializers.Serializer):
    lat = serializers.FloatField(min_value=-90.0, max_value=90.0)
    lng = serializers.FloatField(min_value=-180.0, max_value=180.0)


class PlaceLiteSerializer(serializers.Serializer):
    place_id = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    name = serializers.CharField()
    address = serializers.CharField(allow_null=True, required=False)
    location = LocationSerializer()
    rating = serializers.FloatField(required=False, allow_null=True)
    user_ratings_total = serializers.IntegerField(required=False, allow_null=True)
    open_now = serializers.BooleanField(required=False, allow_null=True)
    photo_reference = serializers.CharField(required=False, allow_null=True)
    icon = serializers.CharField(required=False, allow_null=True)


# backend/temples/serializers/concierge.py
from rest_framework import serializers

class ConciergePlanRequestSerializer(serializers.Serializer):
    query = serializers.CharField()
    language = serializers.CharField(required=False, default="ja")
    locationbias = serializers.CharField(required=False, allow_blank=True)

    transportation = serializers.ChoiceField(
        choices=["walk", "car"], required=False, default="walk"
    )

    # location text aliases
    area = serializers.CharField(required=False, allow_blank=True)
    where = serializers.CharField(required=False, allow_blank=True)
    location_text = serializers.CharField(required=False, allow_blank=True)

    # coords aliases
    lat = serializers.FloatField(required=False, allow_null=True)
    lng = serializers.FloatField(required=False, allow_null=True)
    lon = serializers.FloatField(required=False, allow_null=True)

    # radius aliases
    radius_m = serializers.IntegerField(required=False, allow_null=True)
    radius_km = serializers.CharField(required=False, allow_null=True, allow_blank=True) 

    def validate_query(self, v: str) -> str:
        if not (v or "").strip():
            raise serializers.ValidationError("この項目は必須です。")
        return v

    def validate(self, attrs):
        # ---- area_resolved ----
        area = (
            attrs.get("area")
            or attrs.get("where")
            or attrs.get("location_text")
            or ""
        ).strip()
        attrs["area_resolved"] = area or None

        # ---- lon -> lng ----
        if attrs.get("lng") is None and attrs.get("lon") is not None:
            attrs["lng"] = attrs["lon"]

        lat = attrs.get("lat")
        lng = attrs.get("lng")

        # ---- radius_m resolved ----
        r_m = attrs.get("radius_m")
        r_km = attrs.get("radius_km")

        # radius_km は "5km" など文字列揺れを許容
        if r_m is None and r_km is not None:
            try:
                t = str(r_km).strip().lower()
                if t.endswith("km"):
                    t = t[:-2].strip()
                    r_m = int(float(t) * 1000)
                elif t.endswith("m"):
                    t = t[:-1].strip()
                    r_m = int(float(t))
                elif t:
                    # "5" や "5.0" は km とみなす
                    r_m = int(float(t) * 1000)
            except Exception:
                r_m = None

        if r_m is None:
            r_m = 8000

        # 1..50000 clip
        try:
            r_m = int(r_m)
        except Exception:
            r_m = 8000
        r_m = max(1, min(50000, r_m))
        attrs["radius_m"] = r_m  # plan 側は radius_m のみ参照

        # ---- location validation ----
        if not attrs["area_resolved"] and (lat is None or lng is None):
            raise serializers.ValidationError({"location": ["area または lat/lng が必要です。"]})

        return attrs



class ConciergePlanResponseSerializer(serializers.Serializer):
    # ← APIが直接返すトップレベルの形
    query = serializers.CharField()
    transportation = serializers.ChoiceField(
        choices=["walk", "car"], required=False, default="walk"
    )
    main = PlaceLiteSerializer(allow_null=True, required=False, default=None)
    alternatives = PlaceLiteSerializer(many=True, required=False, default=list)
    route_hints = serializers.DictField(required=False, default=dict)


# 互換 alias（ConciergeResponseSerializer を参照している箇所があるので維持）
ConciergeResponseSerializer = ConciergePlanResponseSerializer

__all__ = [
    "ShrineRecommendationSerializer",
    "LocationSerializer",
    "PlaceLiteSerializer",
    "ConciergePlanRequestSerializer",
    "ConciergePlanResponseSerializer",
    "ConciergeResponseSerializer",
]
