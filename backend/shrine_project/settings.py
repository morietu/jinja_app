# backend/shrine_project/settings.py
from pathlib import Path
import os
import sys
from datetime import timedelta

# ========= パス =========
BASE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BASE_DIR.parent

# ========= conda 環境の DLL / データパス =========
_CONDA_PREFIX = Path(sys.prefix)  # 例: C:\Users\user\Miniforge3\envs\jinja_app_py311
_DLL_DIR     = _CONDA_PREFIX / "Library" / "bin"
_GDAL_DATA_D = _CONDA_PREFIX / "Library" / "share" / "gdal"
_PROJ_LIB_D  = _CONDA_PREFIX / "Library" / "share" / "proj"

# ========= .env の読込（最初に1回だけ。OS環境変数を優先: override=False）=========
for candidate in (REPO_ROOT / ".env.dev", REPO_ROOT / ".env"):
    if candidate.exists():
        try:
            from dotenv import load_dotenv  # optional
            load_dotenv(dotenv_path=candidate, override=False)
        except Exception:
            pass

# ========= 実行環境ヘルパ =========
def in_docker() -> bool:
    if os.path.exists("/.dockerenv") or os.getenv("DOCKER") == "1":
        return True
    try:
        with open("/proc/1/cgroup", "rt") as f:
            t = f.read()
        return ("docker" in t) or ("kubepods" in t)
    except Exception:
        return False

IS_PYTEST = "PYTEST_CURRENT_TEST" in os.environ

def pick_db_host() -> str:
    """
    Docker外で .env に DJANGO_DB_HOST=db が入っていても 127.0.0.1 に矯正。
    Docker内なら env が無ければ 'db' を既定にする。
    """
    env_host = os.getenv("DJANGO_DB_HOST")
    if in_docker():
        return env_host or "db"
    if not env_host or env_host.lower() == "db":
        return "127.0.0.1"
    return env_host

# ========= データベース（単一定義）=========
DB_HOST = pick_db_host()
DB_PORT = os.getenv("DJANGO_DB_PORT", "5432")
DB_NAME = os.getenv("DJANGO_DB_NAME", "jinja_db")
DB_USER = os.getenv("DJANGO_DB_USER", "admin")
DB_PASSWORD = os.getenv("DJANGO_DB_PASSWORD", "jdb50515")

DATABASES = {
    "default": {
        "ENGINE": "django.contrib.gis.db.backends.postgis",
        "NAME": DB_NAME,
        "USER": DB_USER,
        "PASSWORD": DB_PASSWORD,
        "HOST": DB_HOST,
        "PORT": DB_PORT,
        "CONN_MAX_AGE": 0 if IS_PYTEST else 60,
        "OPTIONS": {"connect_timeout": 5},
        "TEST": {"NAME": f"test_{DB_NAME}"},
    }
}

# ========= Cache: REDIS_URL は明示設定のみ。未設定/127.0.0.1なら LocMem =========
def _sanitize_redis_url(url: str) -> str:
    url = (url or "").strip()
    if not url:
        return ""
    # Docker 内で 127.0.0.1 / localhost 指定は接続不可になりがち → フォールバック
    if in_docker() and ("127.0.0.1" in url or "localhost" in url):
        return ""
    return url

REDIS_URL = _sanitize_redis_url(os.getenv("REDIS_URL", ""))
CACHES = _build_cache()

# ========= 効いている設定の確認（必要時のみ）=========
if os.getenv("PRINT_EFFECTIVE_SETTINGS") == "1":
    print(f"[settings] DB_HOST={DB_HOST} REDIS_URL={REDIS_URL}", flush=True)

# ========= GDAL/GEOS の DLL ヒント =========
if hasattr(os, "add_dll_directory"):
    if _DLL_DIR.exists():
        os.add_dll_directory(str(_DLL_DIR))
    _DLL_HINT = os.getenv("GDAL_DLL_DIR")
    if _DLL_HINT and os.path.isdir(_DLL_HINT):
        os.add_dll_directory(_DLL_HINT)

# gdal*.dll 自動検出（必要なら）
try:
    _ = next(_DLL_DIR.glob("gdal*.dll"))
except StopIteration:
    _ = None

# Django が参照する設定値（env > conda 既定）
GDAL_LIBRARY_PATH = os.getenv("GDAL_LIBRARY_PATH")  # 例: C:\...\gdal310.dll
GDAL_DATA         = os.getenv("GDAL_DATA") or (str(_GDAL_DATA_D) if _GDAL_DATA_D.exists() else None)
PROJ_LIB          = os.getenv("PROJ_LIB") or (str(_PROJ_LIB_D)  if _PROJ_LIB_D.exists()  else None)
GEOS_LIBRARY_PATH = os.getenv("GEOS_LIBRARY_PATH")  # 例: C:\...\geos_c.dll

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
    "rest_framework_simplejwt",
    "corsheaders",

    # Local apps
    "users",
    "temples.apps.TemplesConfig",
]

# ========= DRF / 認可 =========
PLACES_THROTTLE_BURST   = os.getenv("PLACES_THROTTLE_BURST",   "30/min")
PLACES_THROTTLE_SUSTAIN = os.getenv("PLACES_THROTTLE_SUSTAIN", "1000/day")

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.BasicAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon":           os.getenv("THROTTLE_ANON", "30/min"),
        "user":           os.getenv("THROTTLE_USER", "120/min"),
        "places":         os.getenv("THROTTLE_PLACES", "60/min"),
        "places_burst":   PLACES_THROTTLE_BURST,
        "places_sustain": PLACES_THROTTLE_SUSTAIN,
    },
    "DEFAULT_ROUTER_TRAILING_SLASH": "/?",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=1),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

AUTH_USER_MODEL = "users.User"

# ========= ミドルウェア =========
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",  # CommonMiddleware より前
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
]

# ========= URL / WSGI =========
ROOT_URLCONF = "shrine_project.urls"
WSGI_APPLICATION = "shrine_project.wsgi.application"

# ========= テンプレート =========
_context_processors = [
    "django.template.context_processors.debug",
    "django.template.context_processors.request",
    "django.template.context_processors.static",
    "django.contrib.auth.context_processors.auth",
    "django.contrib.messages.context_processors.messages",
]
# 任意: 存在する場合だけ独自 CP を追加
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

# ========= 静的 / メディア =========
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"] if (BASE_DIR / "static").exists() else []

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# ========= CORS =========
from corsheaders.defaults import default_headers, default_methods

CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
# CORS_ALLOW_CREDENTIALS = True

CORS_ALLOW_HEADERS = list(default_headers) + [
    "authorization",
    "content-type",
]
CORS_ALLOW_METHODS = list(default_methods)

# ========= OpenAI =========
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# ========= ログ =========
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler", "level": "INFO"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}





# ----------------------------------------
# Cache 設定（pytest中は LocMem を強制、普段は REDIS_URL があり redis クライアントが入っていれば Redis）
# ----------------------------------------
def _build_cache():
    import os
    key_func = "shrine_project.cache_keys.memcache_safe_key"
    # pytest 実行中は無条件で LocMem
    if os.environ.get("PYTEST_CURRENT_TEST"):
        return {
            "default": {
                "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
                "LOCATION": "pytest-cache",
                "TIMEOUT": None,
                "KEY_PREFIX": "jinja_app",
                "KEY_FUNCTION": key_func,
            }
        }
    # ここでは上で決めたモジュール変数 REDIS_URL を使う（os.getenv で読み直さない）
    if REDIS_URL:
        try:
            import redis  # Django 純正の RedisCache が使うクライアント
            return {
                "default": {
                    "BACKEND": "django.core.cache.backends.redis.RedisCache",
                    "LOCATION": REDIS_URL,
                    "TIMEOUT": None,
                    "KEY_PREFIX": "jinja_app",
                    "KEY_FUNCTION": key_func,
                }
            }
        except Exception:
            # redis クライアント未導入/不調なら安全に LocMem へフォールバック
            pass

    # デフォルトは LocMem
    return {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "places-local",
            "TIMEOUT": None,
            "KEY_PREFIX": "jinja_app",
            "KEY_FUNCTION": key_func,
        }
    }

CACHES = _build_cache()

# 確認ログ（任意）
if os.getenv("PRINT_EFFECTIVE_SETTINGS") == "1":
    from django.conf import settings as _s
    print("[settings] Cache BACKEND:", _s.CACHES["default"]["BACKEND"], flush=True)
    print("[settings] Cache LOCATION:", _s.CACHES["default"].get("LOCATION"), flush=True)


