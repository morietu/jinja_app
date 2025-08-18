# jinja_project/context_processors.py
import os

def maps_api_key(request):
    key = os.getenv("GOOGLE_MAPS_API_KEY", "") or os.getenv("MAPS_API_KEY", "")
    # 両方入れておく（テンプレがどちらでも動く）
    return {
        "MAPS_API_KEY": key,
        "GOOGLE_MAPS_API_KEY": key,
    }
