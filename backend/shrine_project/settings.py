# backend/shrine_project/settings.py
import os
import sys
from datetime import timedelta
from pathlib import Path

from corsheaders.defaults import default_headers, default_methods
from dotenv import load_dotenv

# ========= パス =========
BASE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BASE_DIR.parent

# ========= .env を最優先で読み込む（最初に一度だけ）=========
for name in (".env.local", ".env.dev", ".env"):
    p = REPO_ROOT / name if (REPO_ROOT / name).exists() else BASE_DIR / name
    if p.exists():
        load_dotenv(p, override=True)
        os.environ.setdefault("ENV_FILE", str(p))
        break


# ========= ヘルパ =========
def _is_pytest() -> bool:
    if os.getenv("PYTEST_CURRENT_TEST"):
        return True
    argv = " ".join(sys.argv).lower()
    return ("pytest" in argv) or ("py.test" in argv)


def _env_bool(name: str, default: bool) -> bool:
    v = os.getenv(name)
    if v is None:
        return default
    return v.strip().lower() in ("1", "true", "yes", "on")


def _env_float(name: str, default: float) -> float:
    v = os.getenv(name)
    if v is None:
        return default
    try:
        return float(v)
    except ValueError:
        return default


IS_PYTEST = _is_pytest()
USE_GIS = _env_bool("USE_GIS", True)  # ← 既定でGIS有効にしたい場合は True

# feature/develop: small feature flags
# ENABLE_LUCK_BONUS = _env_bool("ENABLE_LUCK_BONUS", True)
# LUCK_BONUS_POINT = _env_float("LUCK_BONUS_POINT", 10.0)
# LUCK_BASE_FIELD = "popular_score"
# LUCK_FLAG_FIELD = ""
# LUCK_BONUS_ELEMENT = "金運"
# LUCK_BONUS_IDS = []


# ========= macOS の GDAL/GEOS/PROJ ヒント =========
if sys.platform == "darwin":
    os.environ.setdefault("GDAL_DATA", "/opt/homebrew/share/gdal")
    os.environ.setdefault("PROJ_LIB", "/opt/homebrew/share/proj")
    GDAL_LIBRARY_PATH = "/opt/homebrew/opt/gdal/lib/libgdal.dylib"
    GEOS_LIBRARY_PATH = "/opt/homebrew/opt/geos/lib/libgeos_c.dylib"


# Windows 用のフォールバック情報（保持だけ）
_CONDA_PREFIX = Path(sys.prefix)
_DLL_DIR = _CONDA_PREFIX / "Library" / "bin"
_GDAL_DATA_D = _CONDA_PREFIX / "Library" / "share" / "gdal"
_PROJ_LIB_D = _CONDA_PREFIX / "Library" / "share" / "proj"


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


def pick_db_host() -> str:
    env_host = os.getenv("DJANGO_DB_HOST")
    if in_docker():
        return env_host or "db"
    if not env_host or env_host.lower() == "db":
        return "127.0.0.1"
    return env_host


# ========= DB 環境変数 =========

DB_HOST = os.getenv("DB_HOST", "127.0.0.1")  # ここは 'db' でもOK（サービス名解決）
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME") or os.getenv("POSTGRES_DB", "jinja_db")
DB_USER = os.getenv("DB_USER") or os.getenv("POSTGRES_USER", "admin")
DB_PASSWORD = os.getenv("DB_PASSWORD") or os.getenv("POSTGRES_PASSWORD", "")
DATABASE_URL = os.getenv("DATABASE_URL")


# ========= データベース決定 =========
if IS_PYTEST:
    # pytest 中は Spatialite (GeoDjango 有効)
    DATABASES = {
        "default": {
            "ENGINE": "django.contrib.gis.db.backends.spatialite",
            "NAME": str(BASE_DIR / "test_gis.sqlite3"),
        }
    }
    if sys.platform == "darwin":
        SPATIALITE_LIBRARY_PATH = os.environ.get(
            "SPATIALITE_LIBRARY_PATH", "/opt/homebrew/lib/mod_spatialite.dylib"
        )
    else:
        SPATIALITE_LIBRARY_PATH = os.environ.get("SPATIALITE_LIBRARY_PATH", "mod_spatialite.so")
else:
    if DATABASE_URL:
        try:
            import dj_database_url

            DATABASES = {"default": dj_database_url.parse(DATABASE_URL, conn_max_age=600)}
        except Exception:
            # フォールバック
            if DATABASE_URL and DATABASE_URL.startswith("postgres"):
                DATABASES = {
                    "default": {
                        "ENGINE": "django.db.backends.postgresql",
                        "NAME": os.getenv("PGDATABASE", DB_NAME),
                        "USER": os.getenv("PGUSER", DB_USER),
                        "PASSWORD": os.getenv("PGPASSWORD", DB_PASSWORD),
                        "HOST": os.getenv("PGHOST", DB_HOST),
                        "PORT": os.getenv("PGPORT", DB_PORT),
                    }
                }
            else:
                DATABASES = {
                    "default": {
                        "ENGINE": "django.db.backends.sqlite3",
                        "NAME": BASE_DIR / "db.sqlite3",
                    }
                }
    else:
        if USE_GIS:
            # 本番/開発で GIS を使うとき（PostGIS）
            DATABASES = {
                "default": {
                    "ENGINE": "django.contrib.gis.db.backends.postgis",
                    "NAME": DB_NAME,  # ← 環境変数を使用
                    "USER": DB_USER,  # ← 環境変数を使用
                    "PASSWORD": DB_PASSWORD,  # ← 環境変数を使用
                    "HOST": DB_HOST,  # ← 環境変数を使用
                    "PORT": DB_PORT,  # ← 環境変数を使用
                    "CONN_MAX_AGE": 60,
                    "OPTIONS": {"connect_timeout": 5},
                    "TEST": {"NAME": f"test_{DB_NAME}"},
                }
            }
        else:
            # 通常の PostgreSQL（GIS なし）
            DATABASES = {
                "default": {
                    "ENGINE": "django.db.backends.postgresql",
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


# ========= キャッシュ =========
def _sanitize_redis_url(url: str) -> str:
    url = (url or "").strip()
    if not url:
        return ""
    if in_docker() and ("127.0.0.1" in url or "localhost" in url):
        return ""
    return url


REDIS_URL = _sanitize_redis_url(os.getenv("REDIS_URL", ""))


def _build_cache():
    key_func = "shrine_project.cache_keys.memcache_safe_key"
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
    if REDIS_URL:
        try:
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
            pass
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

# ========= GDAL/GEOS の最終確定（Windows フォールバック）=========
GDAL_LIBRARY_PATH = os.getenv("GDAL_LIBRARY_PATH", globals().get("GDAL_LIBRARY_PATH"))
GEOS_LIBRARY_PATH = os.getenv("GEOS_LIBRARY_PATH", globals().get("GEOS_LIBRARY_PATH"))
_env_gdal_data = os.getenv("GDAL_DATA")
_env_proj_lib = os.getenv("PROJ_LIB")
if not _env_gdal_data and sys.platform == "win32" and _GDAL_DATA_D.exists():
    _env_gdal_data = str(_GDAL_DATA_D)
if not _env_proj_lib and sys.platform == "win32" and _PROJ_LIB_D.exists():
    _env_proj_lib = str(_PROJ_LIB_D)
GDAL_DATA = _env_gdal_data
PROJ_LIB = _env_proj_lib

# ========= 基本設定 =========
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "django-insecure-dev-key")
DEBUG = os.getenv("DJANGO_DEBUG", "1") == "1"
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "[::1]"]

LANGUAGE_CODE = "ja"
TIME_ZONE = "Asia/Tokyo"
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ========= INSTALLED_APPS =========
INSTALLED_APPS = [
    "favorites",
    # Django built-ins
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.postgres",
    "django_filters",
    # 3rd-party
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    # Local apps
    "users",
    "temples.apps.TemplesConfig",
]

# ✅ pytest 中 または USE_GIS=1 のときは GeoDjango を追加
if (IS_PYTEST or USE_GIS) and "django.contrib.gis" not in INSTALLED_APPS:
    insert_pos = (
        INSTALLED_APPS.index("django.contrib.postgres") + 1
        if "django.contrib.postgres" in INSTALLED_APPS
        else len(INSTALLED_APPS)
    )
    INSTALLED_APPS.insert(insert_pos, "django.contrib.gis")

# ========= ミドルウェア =========
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
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
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:19006",
    "http://127.0.0.1:19006",
    "http://localhost:8081",
    "http://127.0.0.1:8081",
]
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = list(default_headers) + ["authorization", "content-type"]
CORS_ALLOW_METHODS = list(default_methods)

# ========= OpenAI =========
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# ========= DRF / 認可 =========
PLACES_THROTTLE_BURST = os.getenv("PLACES_THROTTLE_BURST", "30/min")
PLACES_THROTTLE_SUSTAIN = os.getenv("PLACES_THROTTLE_SUSTAIN", "1000/day")
PLACES_TEXT_DEFAULT_LOCATION = "35.71,139.80"  # "lat,lng"
PLACES_TEXT_DEFAULT_RADIUS_M = 3000  # メートル

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.BasicAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": os.getenv("THROTTLE_ANON", "30/min"),
        "user": os.getenv("THROTTLE_USER", "120/min"),
        "concierge": os.getenv("THROTTLE_CONCIERGE", "8/min"),
        "places": os.getenv("THROTTLE_PLACES", "60/min"),
    },
    "DEFAULT_ROUTER_TRAILING_SLASH": "/?",
    "DEFAULT_PAGINATION_CLASS": None,
}
if IS_PYTEST:
    REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"].update(
        {
            "anon": "1000/min",
            "user": "1000/min",
            "concierge": "1000/min",
            "places": os.getenv("THROTTLE_PLACES_TEST", "1/min"),
        }
    )

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=1),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

AUTH_USER_MODEL = "auth.User"

# --- logging ---
DJANGO_LOG_LEVEL = os.getenv("DJANGO_LOG_LEVEL", "INFO")
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": DJANGO_LOG_LEVEL},
    "loggers": {
        "temples": {"handlers": ["console"], "level": DJANGO_LOG_LEVEL, "propagate": False}
    },
}

# ========= 機能フラグ =========
# ENABLE_LUCK_BONUS = _env_bool("ENABLE_LUCK_BONUS", True)
# LUCK_BONUS_POINT = _env_float("LUCK_BONUS_POINT", 10.0)
# LUCK_BASE_FIELD = "popular_score"
# LUCK_FLAG_FIELD = ""
# LUCK_BONUS_ELEMENT = "金運"
# LUCK_BONUS_IDS = []

AUTO_GEOCODE_ON_SAVE = os.getenv("AUTO_GEOCODE_ON_SAVE", "1") == "1"
GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY") or os.getenv("GOOGLE_MAPS_API_KEY")

# DEBUG 周り
if DEBUG:
    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SECURE = False
    SESSION_COOKIE_SAMESITE = "Lax"
    CSRF_COOKIE_SAMESITE = "Lax"
else:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SESSION_COOKIE_SAMESITE = "None"
    CSRF_COOKIE_SAMESITE = "None"

# テスト中は外部APIを呼ばない
if IS_PYTEST:
    AUTO_GEOCODE_ON_SAVE = False

# オプション: 有効設定のログ
if os.getenv("PRINT_EFFECTIVE_SETTINGS") == "1":
    from django.conf import settings as _s

    print(f"[settings] DB ENGINE: {_s.DATABASES['default']['ENGINE']}", flush=True)
    print(f"[settings] USE_GIS={USE_GIS} IS_PYTEST={IS_PYTEST}", flush=True)
    print("[settings] Cache BACKEND:", _s.CACHES["default"]["BACKEND"], flush=True)
