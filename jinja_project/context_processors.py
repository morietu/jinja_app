# jinja_project/context_processors.py
from django.conf import settings

def maps_api_key(_request):
    key = settings.GOOGLE_MAPS_API_KEY  # ← settings だけを唯一のソースに
    return {
        "MAPS_API_KEY": settings.GOOGLE_MAPS_API_KEY,
        "MAPS_MAP_ID": settings.GOOGLE_MAPS_MAP_ID,
    }
