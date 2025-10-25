# backend/shrine_project/settings.py
import os
import sys
from pathlib import Path

import dj_database_url
import environ

# --- Paths ---
BASE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BASE_DIR.parent


# ── helpers ──────────────────────────────────────────────────────────────────
def env_bool(name: str, default: bool = False) -> bool:
    v = os.getenv(name)
    if v is None:
        return default
    return v.strip().lower() in {"1", "true", "yes", "on"}


# ===== 環境フラグ（ここだけで定義・決定）=====
IS_PYTEST = (
    env_bool("IS_PYTEST")
    or ("PYTEST_CURRENT_TEST" in os.environ)
    or ("pytest" in " ".join(sys.argv).lower())
)
USE_SQLITE = env_bool("USE_SQLITE", default=False)  # ← 明示したときだけ SQLite
USE_GIS = env_bool("USE_GIS", default=True)
DISABLE_GIS_FOR_TESTS = env_bool("DISABLE_GIS_FOR_TESTS", default=False)

# pytest で GIS を無効化したい時だけ off
if IS_PYTEST and DISABLE_GIS_FOR_TESTS:
    USE_GIS = False

# --- environ init & load .env (最初に読む) ---
env = environ.Env(
    DEBUG=(bool, True),
    USE_LLM_CONCIERGE=(bool, False),
    LLM_MODEL=(str, "gpt-4o-mini"),
    LLM_PROVIDER=(str, "openai"),
    LLM_TIMEOUT_MS=(int, 2500),
    LLM_TEMPERATURE=(float, 0.2),
    LLM_MAX_TOKENS=(int, 800),
    LLM_FORCE_CHAT=(bool, True),
    LLM_FORCE_JSON=(bool, True),
    LLM_BASE_URL=(str, ""),
    LLM_RETRIES=(int, 2),
    LLM_BACKOFF_S=(float, 0.5),
    LLM_CACHE_TTL_S=(int, 600),
    LLM_COORD_ROUND=(int, 3),
    LLM_ENABLE_PLACES=(bool, True),
    LLM_PROMPT_VERSION=(str, "v1"),
)
for name in (".env.local", ".env.dev", ".env"):
    p = (REPO_ROOT / name) if (REPO_ROOT / name).exists() else (BASE_DIR / name)
    if p.exists():
        environ.Env.read_env(str(p))
        os.environ.setdefault("ENV_FILE", str(p))
        break

# --- security / DEBUG ---
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY") or os.environ.get("SECRET_KEY")
if not SECRET_KEY:
    if os.getenv("CI") or IS_PYTEST:
        SECRET_KEY = "django-insecure-ci-only-secret-key-please-override"
    else:
        SECRET_KEY = "django-insecure-dev-only-secret"

DEBUG = env.bool("DEBUG", default=True)

# --- LLM flags ---
# USE_LLM_CONCIERGE = env.bool("USE_LLM_CONCIERGE")
USE_LLM_CONCIERGE = False
LLM_MODEL = env.str("LLM_MODEL")
LLM_PROVIDER = env.str("LLM_PROVIDER")
LLM_TIMEOUT_MS = env.int("LLM_TIMEOUT_MS")
LLM_TEMPERATURE = env.float("LLM_TEMPERATURE")
LLM_MAX_TOKENS = env.int("LLM_MAX_TOKENS")
LLM_FORCE_CHAT = env.bool("LLM_FORCE_CHAT")
LLM_FORCE_JSON = env.bool("LLM_FORCE_JSON")
LLM_BASE_URL = env.str("LLM_BASE_URL")
LLM_RETRIES = env.int("LLM_RETRIES")
LLM_BACKOFF_S = env.float("LLM_BACKOFF_S")
LLM_CACHE_TTL_S = env.int("LLM_CACHE_TTL_S")
LLM_COORD_ROUND = env.int("LLM_COORD_ROUND")
LLM_ENABLE_PLACES = env.bool("LLM_ENABLE_PLACES")
LLM_PROMPT_VERSION = env.str("LLM_PROMPT_VERSION")
LLM_PROMPTS_DIR = str(BASE_DIR.parent / "backend" / "prompts")

# --- macOS GDAL/GEOS hint ---
if sys.platform == "darwin":
    os.environ.setdefault("GDAL_DATA", "/opt/homebrew/share/gdal")
    os.environ.setdefault("PROJ_LIB", "/opt/homebrew/share/proj")
    GDAL_LIBRARY_PATH = "/opt/homebrew/opt/gdal/lib/libgdal.dylib"  # noqa: F841
    GEOS_LIBRARY_PATH = "/opt/homebrew/opt/geos/lib/libgeos_c.dylib"  # noqa: F841

# --- DB envs ---
DB_HOST = os.getenv("DB_HOST", "db")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME") or os.getenv("POSTGRES_DB", "jinja_db")
DB_USER = os.getenv("DB_USER") or os.getenv("POSTGRES_USER", "admin")
DB_PASSWORD = os.getenv("DB_PASSWORD") or os.getenv("POSTGRES_PASSWORD", "")

# --- DATABASES（SQLite を選ぶ時だけ SQLite。デフォルトは Postgres/PostGIS） ---
DATABASE_URL = os.getenv("DATABASE_URL")

if USE_SQLITE:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": os.path.join(BASE_DIR, "db.sqlite3"),
            "TEST": {"NAME": f"test_{DB_NAME}"},
        }
    }
else:
    if DATABASE_URL:
        db = dj_database_url.parse(DATABASE_URL, conn_max_age=600)
        scheme = DATABASE_URL.split(":", 1)[0].lower()
        if scheme == "postgis":
            db["ENGINE"] = "django.contrib.gis.db.backends.postgis"
        elif scheme in {"postgres", "postgresql"}:
            db["ENGINE"] = (
                "django.contrib.gis.db.backends.postgis"
                if USE_GIS
                else "django.db.backends.postgresql"
            )
        DATABASES = {"default": db}
    else:
        # DATABASE_URL が無い時の既定：PostgreSQL/（GISはフラグで切替）
        DATABASES = {
            "default": {
                "ENGINE": (
                    "django.contrib.gis.db.backends.postgis"
                    if USE_GIS
                    else "django.db.backends.postgresql"
                ),
                "NAME": DB_NAME,
                "USER": DB_USER,
                "PASSWORD": DB_PASSWORD,
                "HOST": DB_HOST,
                "PORT": DB_PORT,
                "CONN_MAX_AGE": 60,
                "OPTIONS": {"connect_timeout": 5},
                "TEST": {"NAME": f"test_{DB_NAME}"},
            }
        }

# CI は接続プーリング無効
if os.getenv("CI") == "true":
    DATABASES["default"]["CONN_MAX_AGE"] = 0

# エンジン別の最終調整
engine = DATABASES["default"]["ENGINE"]
if engine.endswith("sqlite3"):
    for k in ("USER", "PASSWORD", "HOST", "PORT", "OPTIONS", "CONN_MAX_AGE"):
        DATABASES["default"].pop(k, None)
else:
    # PostgreSQL/POSTGIS のときだけ connect_timeout 等を整える
    DATABASES["default"].setdefault("OPTIONS", {})
    DATABASES["default"]["OPTIONS"].setdefault("connect_timeout", 5)
    DATABASES["default"].setdefault("HOST", DB_HOST)
    DATABASES["default"].setdefault("PORT", DB_PORT)
    DATABASES["default"].setdefault("USER", DB_USER)
    DATABASES["default"].setdefault("PASSWORD", DB_PASSWORD)

# --- Apps / Middleware ---
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
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    # Local apps
    "users",
    "temples.apps.TemplesConfig",
    "drf_spectacular",
]

# GIS はフラグのみで制御（pytest かどうかでは切り替えない）
if USE_GIS:
    if "django.contrib.gis" not in INSTALLED_APPS:
        pos = (
            INSTALLED_APPS.index("django.contrib.postgres") + 1
            if "django.contrib.postgres" in INSTALLED_APPS
            else len(INSTALLED_APPS)
        )
        INSTALLED_APPS.insert(pos, "django.contrib.gis")

ROUTE_PROVIDERS = {"dummy", "google", "mapbox", "osrm"}
ROUTE_PROVIDER = os.getenv("ROUTE_PROVIDER") or ("dummy" if IS_PYTEST else "osrm")

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
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
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "django.template.context_processors.i18n",
                "django.template.context_processors.media",
                "django.template.context_processors.static",
                "django.template.context_processors.tz",
            ],
        },
    },
]

ROOT_URLCONF = "shrine_project.urls"

# --- DRF / Throttle ---
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ),
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.ScopedRateThrottle",
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "anon": "60/min",
        "user": "120/min",
        "concierge": "60/min",
        "places": "30/min",
        "places-nearby": os.getenv("PLACES_NEARBY_RATE", "30/min"),
        "shrines": "60/min",
        "route": "20/min",
        "geocode": "30/min",
        "favorites": "30/min",
        "routes": "60/min",
    },
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.AllowAny",),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
}

REST_FRAMEWORK.update(
    {
        "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    }
)
SPECTACULAR_SETTINGS = {
    "TITLE": "Shrine API",
    "VERSION": "v1",
}

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "throttle-cache",
    }
}

# --- Google / Optional ---
AUTO_GEOCODE_ON_SAVE = os.getenv("AUTO_GEOCODE_ON_SAVE", "0").lower() in ("1", "true", "yes")
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")
GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "") or GOOGLE_MAPS_API_KEY


# --- Hosts / CORS ---
def _split_csv(s, default=None):
    if s is None:
        return default or []
    return [x.strip() for x in s.split(",") if x.strip()]


ALLOWED_HOSTS = _split_csv(os.environ.get("ALLOWED_HOSTS"), ["localhost", "127.0.0.1", "web"])
CSRF_TRUSTED_ORIGINS = _split_csv(
    os.environ.get("CSRF_TRUSTED_ORIGINS"),
    ["http://localhost:3001", "http://127.0.0.1:3001"],
)
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = _split_csv(
    os.environ.get("CORS_ALLOWED_ORIGINS"),
    [
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
)

# --- i18n / static ---
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

LANGUAGE_CODE = "ja"
TIME_ZONE = "Asia/Tokyo"
USE_I18N = True
USE_TZ = True
