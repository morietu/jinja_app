# conftest.py（リポジトリルート）
import os
import sys

import django

# backend/ を import path に追加
ROOT = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(ROOT, "backend"))

# Django settings を指す
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "shrine_project.settings")

# テスト用の安全な既定値（キー未設定で 401 にならないように）
os.environ.setdefault("USE_GIS", "0")
os.environ.setdefault("OPENAI_API_KEY", "dummy")
os.environ.setdefault("GOOGLE_MAPS_API_KEY", "dummy")
os.environ.setdefault("GOOGLE_PLACES_API_KEY", "dummy")

django.setup()
