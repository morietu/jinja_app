# backend/shrine_project/settings.py
from pathlib import Path
import os
import sys
from datetime import timedelta

_CONDA_PREFIX = Path(sys.prefix)  # 例: C:\Users\user\Miniforge3\envs\jinja_app_py311
_DLL_DIR     = _CONDA_PREFIX / "Library" / "bin"
_GDAL_DATA   = _CONDA_PREFIX / "Library" / "share" / "gdal"
_PROJ_LIB    = _CONDA_PREFIX / "Library" / "share" / "proj"

# manage.py でもやっているが、settings 側でもベルト＆サスペンダーで通す
if hasattr(os, "add_dll_directory") and _DLL_DIR.exists():
    os.add_dll_directory(str(_DLL_DIR))

# gdal*.dll を自動検出(conda は gdal.dll のことがある)
_gdal_dll = None
try:
    for p in _DLL_DIR.glob("gdal*.dll"):
        _gdal_dll = p
        break
except Exception:
    pass

# Django が参照する設定値
GDAL_LIBRARY_PATH = os.getenv("GDAL_LIBRARY_PATH")
GDAL_DATA         = os.getenv("GDAL_DATA")
PROJ_LIB          = os.getenv("PROJ_LIB")
GEOS_LIBRARY_PATH = os.getenv("GEOS_LIBRARY_PATH")

# ========= パス =========
BASE_DIR = Path(__file__).resolve().parent.parent   # .../backend/shrine_project
REPO_ROOT = BASE_DIR.parent                         # .../backend → repo root (jinja_app)

# ========= .env の読込(存在するものだけ)=========
for candidate in (REPO_ROOT / ".env.dev", REPO_ROOT / ".env"):
    if candidate.exists():
        try:
            from dotenv import load_dotenv
            load_dotenv(candidate, override=True)
        except Exception:
            pass

# ========= 基本設定 =========
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "django-insecure-dev-key")
DEBUG = True
ALLOWED_HOSTS = ["*"]

LANGUAGE_CODE = "ja"
TIME_ZONE = "Asia/Tokyo"
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ========= アプリ =========
INSTALLED_APPS = [
    "favorites",

    # Django built-ins
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # GeoDjango
    "django.contrib.gis",

    # 3rd-party
    "rest_framework",
    #"rest_framework_simplejwt",
    "corsheaders",

    # Local apps
    "users",
    "temples.apps.TemplesConfig",
]
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",  # ← JWT を有効化
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.BasicAuthentication",        # （Browsable API 用に残してOK）
    ),
    # 既定の権限はお好みで。View 側で IsAuthenticated を付けていれば省略可
    # "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.AllowAny",),
}

# 任意（トークン寿命を明示したい場合）
import datetime
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": datetime.timedelta(hours=1),
    "REFRESH_TOKEN_LIFETIME": datetime.timedelta(days=7),
}


AUTH_USER_MODEL = "users.User"

# ========= ミドルウェア(最小・安全順)=========
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # CORS を使うなら次行を有効化(CommonMiddleware より前)
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
]

# ========= URL / WSGI =========
ROOT_URLCONF = "shrine_project.urls"
WSGI_APPLICATION = "shrine_project.wsgi.application"

# ========= テンプレート(adminに必要な最小構成)=========
_context_processors = [
    "django.template.context_processors.debug",
    "django.template.context_processors.request",
    "django.template.context_processors.static",
    "django.contrib.auth.context_processors.auth",
    "django.contrib.messages.context_processors.messages",
]
# 任意: 存在する場合だけ独自CPを追加(無ければスキップ)
try:
    import importlib
    importlib.import_module("shrine_project.context_processors")
    _context_processors.append("shrine_project.context_processors.maps_api_key")
except Exception:
    pass

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {"context_processors": _context_processors},
    }
]

# ========= データベース(まずは SQLite)=========
def _env(name, fallback_name, default=None):
    return os.getenv(name, os.getenv(fallback_name, default))

DATABASES = {
    "default": {
        "ENGINE": "django.contrib.gis.db.backends.postgis",
        "NAME": os.getenv("DJANGO_DB_NAME", "jinja_db"),
        "USER": os.getenv("DJANGO_DB_USER", "admin"),
        "PASSWORD": os.getenv("DJANGO_DB_PASSWORD", ""),
        "HOST": os.getenv("DJANGO_DB_HOST", "db"),
        "PORT": os.getenv("DJANGO_DB_PORT", "5432"),
    }
}

# ========= DRF / JWT =========
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.AllowAny",
        "rest_framework.permissions.IsAuthenticated",
    
    ),
    "DEFAULT_ROUTER_TRAILING_SLASH": "/?",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "AUTH_HEADER_TYPES": ("Bearer",),

}

# ========= 静的/メディア =========
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"] if (BASE_DIR / "static").exists() else []

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# ========= CORS(必要になったら有効化)=========
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
# CORS_ALLOW_CREDENTIALS = True
from corsheaders.defaults import default_headers, default_methods

CORS_ALLOW_HEADERS = list(default_headers) + [
    "authorization",
    "content-type",
]

CORS_ALLOW_METHODS = list(default_methods)  # ["DELETE","GET","OPTIONS","PATCH","POST","PUT"]

# ========= OpenAI キー(使う側で settings.OPENAI_API_KEY を参照)=========
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# ========= ログ(切り分け用に最小)=========
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler", "level": "INFO"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}
