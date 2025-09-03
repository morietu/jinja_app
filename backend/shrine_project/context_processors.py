from django.conf import settings
import os

def maps_api_key(request):
    """
    Provide GOOGLE_MAPS_API_KEY to templates.

    Falls back to environment var if the Django setting is missing,
    and to "" if neither exist (so templates don't crash in tests).
    """
    key = getattr(settings, "GOOGLE_MAPS_API_KEY", None) or os.environ.get("GOOGLE_MAPS_API_KEY", "")
    return {"GOOGLE_MAPS_API_KEY": key}
