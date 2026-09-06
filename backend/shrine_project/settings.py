# backend/shrine_project/settings.py
import os
import sys
from pathlib import Path

import dj_database_url
import environ
from urllib.parse import urlparse


# --- Paths ---
BASE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BASE_DIR.parent

# 1日あたりの無料利用回数（必要に応じて調整）
CONCIERGE_DAILY_FREE_LIMIT = 5

# ── helpers ──────────────────────────────────────────────────────────────────
def env_bool(name: str, default: bool = False) -> bool:
    v = os.getenv(name)
    if v is None:
        return default
    return v.strip().lower() in {"1", "true", "yes", "on"}


# --- environ init & load .env (最初に読む) ---
env = environ.Env(
    DEBUG=(bool, True),
    CONCIERGE_USE_LLM=(bool, False),
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

# --- env load before flag computation ---
env_file = BASE_DIR / ".env.local"
if env_file.exists():
    environ.Env.read_env(str(env_file))
    os.environ["ENV_FILE"] = str(env_file)

# pytest かどうかは .env.test を読む前に一度だけ仮判定する
IS_PYTEST = (
    env_bool("IS_PYTEST")
    or ("PYTEST_CURRENT_TEST" in os.environ)
    or ("pytest" in " ".join(sys.argv).lower())
)

if IS_PYTEST:
    test_env_file = BASE_DIR / ".env.test"
    if test_env_file.exists():
        environ.Env.read_env(str(test_env_file), overwrite=True)
        os.environ["ENV_FILE"] = str(test_env_file)

# ===== 環境フラグ（ここだけで定義・決定）=====
IS_PYTEST = (
    env_bool("IS_PYTEST")
    or ("PYTEST_CURRENT_TEST" in os.environ)
    or ("pytest" in " ".join(sys.argv).lower())
)
USE_SQLITE = env_bool("USE_SQLITE", default=False)  # ← 明示したときだけ SQLite
USE_GIS = env_bool("USE_GIS", default=True)
DISABLE_GIS_FOR_TESTS = env_bool("DISABLE_GIS_FOR_TESTS", default=False)

# temples の NoGIS squashed migration set（temples/migrations_nogis/）へ切り替えて
# よいのは、実際に pytest 経由で起動し、かつ明示的に GIS を無効化したい場合だけ。
# `not USE_SQLITE` は SQLite 実行時の既存挙動（spatialite/sqlite3 の通常経路）を
# 変えないためのガード。
#
# 過去に一度、このガードから IS_PYTEST 判定が失われ（commit d5655e17b,
# 2026-03-16）、単なる `not USE_GIS and not USE_SQLITE` になっていたことがある。
# IS_PYTEST は実際の pytest プロセス以外では絶対に true にならないが、
# `USE_GIS` 単体は本番の環境変数一つで（意図せず）false になり得るため、
# その版では Production 環境で USE_GIS が false に倒れた際に
# `temples.migrations_nogis`（テスト/CI専用の squashed migration lineage、
# 通常の 99 件超の temples/migrations/ とは無関係に手動維持されている別物）へ
# 静かに切り替わってしまい、Production の migration lineage 混入という実害を
# 起こした（詳細: docs/audit/production-migration-modules-nogis-root-cause.md）。
# 二度と `USE_GIS` 単体を判定条件にしないよう、ここで判定用の変数として
# 明示的に固定する。
TEMPLES_USE_NOGIS_MIGRATIONS = IS_PYTEST and DISABLE_GIS_FOR_TESTS and not USE_SQLITE

# pytest で GIS を無効化したい時だけ off（フラグ解釈はここで一度だけ）
if TEMPLES_USE_NOGIS_MIGRATIONS:
    USE_GIS = False

# SQLite + GIS を使う場合のためのヒント
if USE_SQLITE and USE_GIS:
    os.environ.setdefault("SPATIALITE_LIBRARY_PATH", "mod_spatialite")

# --- security / DEBUG ---
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    if os.getenv("CI") or IS_PYTEST:
        SECRET_KEY = "django-insecure-ci-only-secret-key-please-override"
    else:
        SECRET_KEY = "django-insecure-dev-only-secret"

DEBUG = env.bool("DEBUG", default=True)

# --- LLM flags ---
# 正: CONCIERGE_USE_LLM
# 互換: USE_LLM_CONCIERGE（過去の env 名を吸収）
CONCIERGE_USE_LLM = env.bool("CONCIERGE_USE_LLM", default=False) or env.bool(
    "USE_LLM_CONCIERGE", default=False
)
# backward-compat (deprecated)
USE_LLM_CONCIERGE = CONCIERGE_USE_LLM
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
DATABASE_URL = os.getenv("DATABASE_URL")

if IS_PYTEST and USE_SQLITE:
    raise RuntimeError("pytest は PostgreSQL/PostGIS 前提です。USE_SQLITE=1 は使用しないでください。")


def build_database_config() -> dict:
    conn_max_age = 0 if DEBUG else 600

    if USE_SQLITE:
        sqlite_engine = (
            "django.contrib.gis.db.backends.spatialite"
            if USE_GIS
            else "django.db.backends.sqlite3"
        )
        return {
            "ENGINE": sqlite_engine,
            "NAME": os.path.join(BASE_DIR, "db.sqlite3"),
            "TEST": {"NAME": f"test_{DB_NAME}"},
        }

    if DATABASE_URL:
        db = dj_database_url.parse(DATABASE_URL, conn_max_age=conn_max_age)

        scheme = DATABASE_URL.split(":", 1)[0].lower()
        if scheme == "postgis":
            db["ENGINE"] = "django.contrib.gis.db.backends.postgis"
        elif scheme in {"postgres", "postgresql"}:
            db["ENGINE"] = (
                "django.contrib.gis.db.backends.postgis"
                if USE_GIS
                else "django.db.backends.postgresql"
            )

        db.setdefault("OPTIONS", {})
        db["OPTIONS"].setdefault("connect_timeout", 5)
        db.setdefault("TEST", {"NAME": f"test_{DB_NAME}"})
        return db

    return {
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
        "CONN_MAX_AGE": conn_max_age,
        "OPTIONS": {"connect_timeout": 5},
        "TEST": {"NAME": f"test_{DB_NAME}"},
    }


DATABASES = {
    "default": build_database_config()
}

# ---- NoGIS固定（テスト/CIで使う）: DB構成は変えず migration だけ切り替える ----
# `TEMPLES_USE_NOGIS_MIGRATIONS`（pytest かつ DISABLE_GIS_FOR_TESTS の場合のみ
# true）でのみ発火する。`USE_GIS` 単体では絶対に判定しない — Production 等の
# 通常起動プロセスでは IS_PYTEST が true になり得ないため、USE_GIS が
# どんな値であってもこのブロックは発火しない。
if TEMPLES_USE_NOGIS_MIGRATIONS:
    MIGRATION_MODULES = {**globals().get("MIGRATION_MODULES", {})}
    MIGRATION_MODULES["temples"] = "temples.migrations_nogis"

# --- 起動時サマリ（DEBUG または CI） ---
if DEBUG or os.getenv("CI") == "true":
    try:
        _eng = DATABASES["default"]["ENGINE"]
        _name = DATABASES["default"].get("NAME") or DATABASE_URL or "<from env>"
    except Exception:
        pass

# --- Apps / Middleware ---
INSTALLED_APPS = [
    # Django built-ins（先）
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.postgres",
    # 3rd-party
    "django_filters",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "drf_spectacular",
    # Local apps（後）
    "users",
    "temples.apps.TemplesConfig",
    "storages",
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
# GIS を使わない構成にする場合のみ、gisアプリを落とす
if not USE_GIS and "django.contrib.gis" in INSTALLED_APPS:
    INSTALLED_APPS.remove("django.contrib.gis")

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

APPEND_SLASH = False

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
        "anon": "100/min",
        "user": "100/min",

        # feature scopes
        "concierge": "8/min",          # ← 仕様として固定
        "deep_dive": "8/min",          # concierge同様、LLM呼び出しを伴うため保守的に固定
        "compass": "20/min",           # LLM呼び出しなし、DB検索+スコアリングのみ
        "places": "30/min",
        "places-nearby": "30/min",
        "shrines": "60/min",
        "route": "20/min",
        "geocode": "30/min",
        "favorites": "30/min",
        "routes": "60/min",
        "shrines_ingest": "1/min",
    },
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.AllowAny",),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 10,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

_rates = REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]

# env 上書き（必要なときだけ）
if os.getenv("THROTTLE_CONCIERGE"):
    _rates["concierge"] = os.environ["THROTTLE_CONCIERGE"]

if os.getenv("THROTTLE_PLACES_NEARBY"):
    _rates["places-nearby"] = os.environ["THROTTLE_PLACES_NEARBY"]

if os.getenv("THROTTLE_SHRINES_INGEST"):
    _rates["shrines_ingest"] = os.environ["THROTTLE_SHRINES_INGEST"]

# ローカルでスロットルほぼ無効（例外: ingestは守る）
if os.getenv("DISABLE_THROTTLE", "0") == "1":
    for k in list(_rates.keys()):
        if k != "shrines_ingest":
            _rates[k] = "1000/min"

# 旧 env 名互換（これも “あれば上書き” だけ）
if os.getenv("CONCIERGE_THROTTLE"):
    _rates["concierge"] = os.environ["CONCIERGE_THROTTLE"]

# pytest は concierge を緩めない（仕様固定）
# 必要なら「テスト専用scope」だけいじる
if IS_PYTEST:
    _rates["places-nearby"] = "2/min"


SPECTACULAR_SETTINGS = {
    "TITLE": "Shrine API",
    "VERSION": "v1",
    "PREPROCESSING_HOOKS": [
        "temples.api.schema_hooks.preprocess_exclude_compat_paths",
    ],
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

# Google Places upstream kill switch。
# 明示的に OFF（0/false/no/off）にした時だけ Google への HTTP request を停止する。
# 未設定時は既存動作のまま有効。
GOOGLE_PLACES_ENABLED = os.getenv("GOOGLE_PLACES_ENABLED", "1").strip().lower() not in (
    "0",
    "false",
    "no",
    "off",
)

# Stripe
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_PRICE_ID = os.getenv("STRIPE_PRICE_ID", "")
STRIPE_PREMIUM_PRICE_ID = os.getenv("STRIPE_PREMIUM_PRICE_ID", "") or STRIPE_PRICE_ID
STRIPE_WEBHOOK_DEBUG = os.getenv("STRIPE_WEBHOOK_DEBUG", "0") == "1"


# --- Hosts / CORS ---
def _split_csv(s, default=None):
    if s is None:
        return default or []
    return [x.strip() for x in s.split(",") if x.strip()]



ALLOWED_HOSTS = _split_csv(os.environ.get("ALLOWED_HOSTS"), ["localhost", "127.0.0.1", "web"])
for host in ["localhost", "127.0.0.1", "0.0.0.0", "web"]:
    if host not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(host)
RENDER_EXTERNAL_HOSTNAME = os.environ.get("RENDER_EXTERNAL_HOSTNAME")
if RENDER_EXTERNAL_HOSTNAME and RENDER_EXTERNAL_HOSTNAME not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)
if ".onrender.com" not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(".onrender.com")


CORS_TRUSTED_ORIGINS_DEFAULTS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:8081",
    "http://127.0.0.1:8081",
]
CSRF_TRUSTED_ORIGINS = _split_csv(
    os.environ.get("CSRF_TRUSTED_ORIGINS"),
    CORS_TRUSTED_ORIGINS_DEFAULTS,
)
if RENDER_EXTERNAL_HOSTNAME:
    render_origin = f"https://{RENDER_EXTERNAL_HOSTNAME}"
    if render_origin not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(render_origin)

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = _split_csv(
    os.environ.get("CORS_ALLOWED_ORIGINS"),
    [
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
    ],
)

# --- i18n / static ---
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"


LANGUAGE_CODE = "ja"
TIME_ZONE = "Asia/Tokyo"
USE_I18N = True
USE_TZ = True

STORAGE_LIMIT_BYTES = int(os.getenv("STORAGE_LIMIT_BYTES", str(200 * 1024 * 1024)))
RELEASE = os.getenv("RENDER_GIT_COMMIT", "local")


# --- Storage ---
STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "local")  # local / r2

if STORAGE_BACKEND == "r2":
    STORAGES = {
        "default": {"BACKEND": "storages.backends.s3boto3.S3Boto3Storage"},
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    }

    AWS_ACCESS_KEY_ID = os.environ["R2_ACCESS_KEY_ID"]
    AWS_SECRET_ACCESS_KEY = os.environ["R2_SECRET_ACCESS_KEY"]
    AWS_STORAGE_BUCKET_NAME = os.environ["R2_BUCKET"]
    AWS_S3_ENDPOINT_URL = os.environ["R2_ENDPOINT_URL"]

    AWS_S3_REGION_NAME = "auto"
    AWS_S3_SIGNATURE_VERSION = "s3v4"
    AWS_DEFAULT_ACL = None
    AWS_QUERYSTRING_AUTH = False
    AWS_S3_FILE_OVERWRITE = False
    AWS_S3_ADDRESSING_STYLE = "path"

    R2_PUBLIC_BASE_URL = os.environ["R2_PUBLIC_BASE_URL"].rstrip("/")
    AWS_S3_CUSTOM_DOMAIN = urlparse(R2_PUBLIC_BASE_URL).netloc
    MEDIA_URL = R2_PUBLIC_BASE_URL + "/"
    MEDIA_ROOT = None
else:
    MEDIA_URL = "/media/"
    MEDIA_ROOT = Path(os.getenv("MEDIA_ROOT", str(BASE_DIR / "media")))


# --- Logging ---
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "simple": {"format": "%(levelname)s %(name)s: %(message)s"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "simple"},
    },
    "root": {  # ← これが無いと “大半のログ” が死ぬ
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django.server": {  # ← runserver のアクセスログ
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "temples.services.concierge_chat": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "temples.api_views_concierge": {   # ←追加
        "handlers": ["console"],
        "level": "INFO",
        "propagate": False,
        },
        "users.api.views": {
            "handlers": ["console"],
            "level": "DEBUG" if STRIPE_WEBHOOK_DEBUG else "INFO",
            "propagate": False,
        },
        "temples.services.google_places": {
            "handlers": ["console"],
            "level": "DEBUG",
            "propagate": False,
        },
    },
}
