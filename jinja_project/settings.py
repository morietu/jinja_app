from pathlib import Path
import os
from dotenv import load_dotenv, find_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(find_dotenv())

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'django-insecure-...')
DEBUG = os.getenv("DJANGO_DEBUG", "False") == "True"

ALLOWED_HOSTS = os.getenv("DJANGO_ALLOWED_HOSTS", "*").split(",")
CSRF_TRUSTED_ORIGINS = os.getenv("DJANGO_CSRF_TRUSTED_ORIGINS", "").split(",") if os.getenv("DJANGO_CSRF_TRUSTED_ORIGINS") else []
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # 追加
    'csp',          # ← ここで1回だけ追加（+= は使わない）
    # Local apps
    'temples',
    'accounts',
]

MIDDLEWARE = [
    # 追加ミドルウェアは“先頭付近”に置く（自己展開しない）
    'csp.middleware.CSPMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# --- 開発向けの緩めCSP（本番は可能なら unsafe-* を外す） ---
if DEBUG:
    CSP_DEFAULT_SRC = ("'self'",)
    CSP_SCRIPT_SRC = (
        "'self'",
        "https://maps.googleapis.com",
        "https://maps.gstatic.com",
        "'unsafe-inline'",  # route.html のインライン <script> があるため
        "'unsafe-eval'",    # Maps JS が一部 eval 系を使うため
    )
    CSP_IMG_SRC = ("'self'", "data:", "https://*.googleapis.com", "https://*.gstatic.com", "https://*.google.com")
    CSP_STYLE_SRC = ("'self'", "'unsafe-inline'")

ROOT_URLCONF = 'jinja_project.urls'
WSGI_APPLICATION = 'jinja_project.wsgi.application'

DATABASES = {
    'default': {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "jinja_db",
        "USER": "admin",
        "PASSWORD": "jdb50515",
        "HOST": "127.0.0.1",
        "PORT": "5433",
    }
}

LANGUAGE_CODE = "ja"
TIME_ZONE = "Asia/Tokyo"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"]

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [BASE_DIR / "templates"],
    'APP_DIRS': True,
    'OPTIONS': {
        'context_processors': [
            "django.template.context_processors.debug",
            'django.template.context_processors.request',
            "django.template.context_processors.static",
            'django.contrib.auth.context_processors.auth',
            'django.contrib.messages.context_processors.messages',
            "jinja_project.context_processors.maps_api_key",
        ],
    },
}]

LOGIN_REDIRECT_URL = "mypage"
LOGOUT_REDIRECT_URL = "/"

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")
GOOGLE_MAPS_MAP_ID  = os.getenv("GOOGLE_MAPS_MAP_ID", "DEMO_MAP_ID")
