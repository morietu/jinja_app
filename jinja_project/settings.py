from pathlib import Path
import os
from dotenv import load_dotenv, find_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(find_dotenv())

# ---- Locale / TZ（重複しないように一度だけ定義）----
LANGUAGE_CODE = "ja"
TIME_ZONE = "Asia/Tokyo"
USE_I18N = True
USE_TZ = True

# ---- セキュリティ / 基本設定 ----
DEBUG = os.getenv("DJANGO_DEBUG", "False") == "True"
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-only-secret")  # ← 本番は必ず環境変数で
ALLOWED_HOSTS = os.getenv("DJANGO_ALLOWED_HOSTS", "*").split(",")
CSRF_TRUSTED_ORIGINS = os.getenv("DJANGO_CSRF_TRUSTED_ORIGINS", "").split(",") if os.getenv("DJANGO_CSRF_TRUSTED_ORIGINS") else []
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# ---- Static files ----
STATIC_URL = "/static/"                       # ← 先頭/末尾スラッシュ
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"]

# WhiteNoise（圧縮＋マニフェスト）
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # ← SecurityMiddleware 直後でOK
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],       # ← ここで定義済み。下で再代入しない
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "jinja_project.context_processors.maps_api_key",
            ],
        },
    },
]

# 認証後の遷移
LOGIN_REDIRECT_URL = "mypage"
LOGOUT_REDIRECT_URL = "/"

# 開発用メール
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
DEFAULT_FROM_EMAIL = "noreply@example.com"
