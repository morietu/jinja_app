# shrine_project/settings.py
import os
import sys
from datetime import timedelta
from pathlib import Path

import dj_database_url
import environ

ROUTE_PROVIDERS = {"dummy", "google", "mapbox", "osrm"}  # ← 'osrm' は集合に含める
ROUTE_PROVIDER = os.environ.get("ROUTE_PROVIDER", "dummy")  # ← 既定は dummy（テスト向き）

# --- 1) BASE_DIR は最初に ---
BASE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BASE_DIR.parent

# --- 2) django-environ を初期化（型 & 既定値をここで宣言）---
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

# --- 3) .env を読む（存在すれば）---
#   ルート(.env)→ backend/.env のどちらでもOKなように順番に探す
for name in (".env.local", ".env.dev", ".env"):
    p = (REPO_ROOT / name) if (REPO_ROOT / name).exists() else (BASE_DIR / name)
    if p.exists():
        environ.Env.read_env(str(p))
        os.environ.setdefault("ENV_FILE", str(p))
        break

# --- 4) 以降は env から型付き取得（ただし SECRET_KEY は直接 os.environ から読む） ---
# すでに冒頭で `import os` 済み。再インポートは不要。
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY") or os.environ.get("SECRET_KEY")

# CI / pytest で未設定だった場合のフォールバック（本番は必ず Secrets で上書きされる想定）
if not SECRET_KEY:
    if os.environ.get("CI") or os.environ.get("PYTEST_CURRENT_TEST"):
        SECRET_KEY = "django-insecure-ci-only-secret-key-please-override"
    else:
        SECRET_KEY = "django-insecure-dev-only-secret"

DEBUG = env.bool("DEBUG", default=True)

# ========= LLM / Concierge flags（※ここで一度だけ定義）=========
USE_LLM_CONCIERGE = env.bool("USE_LLM_CONCIERGE")
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

# prompts ディレクトリ（※ここで一度だけ定義）
LLM_PROMPTS_DIR = str(BASE_DIR.parent / "backend" / "prompts")


SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),  # dev: 30分
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),  # dev: 7日
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}


# ========= 小ユーティリティ =========
def _is_pytest() -> bool:
    if os.getenv("PYTEST_CURRENT_TEST"):
        return True
    argv = " ".join(sys.argv).lower()
    return ("pytest" in argv) or ("py.test" in argv)


IS_PYTEST = _is_pytest()
DISABLE_GIS_FOR_TESTS = os.getenv("DISABLE_GIS_FOR_TESTS", "0") == "1"
USE_GIS = os.getenv("USE_GIS", "1").lower() in ("1", "true", "yes")  # ← ここだけで定義（重複禁止）

# ========= macOS GDAL/GEOS ヒント（必要な人向け）=========
if sys.platform == "darwin":
    os.environ.setdefault("GDAL_DATA", "/opt/homebrew/share/gdal")
    os.environ.setdefault("PROJ_LIB", "/opt/homebrew/share/proj")
    GDAL_LIBRARY_PATH = "/opt/homebrew/opt/gdal/lib/libgdal.dylib"  # noqa: F841
    GEOS_LIBRARY_PATH = "/opt/homebrew/opt/geos/lib/libgeos_c.dylib"  # noqa: F841

# ========= DB 環境変数 =========
DB_HOST = os.getenv("DB_HOST", "db")  # ← Docker のサービス名
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME") or os.getenv("POSTGRES_DB", "jinja_db")
DB_USER = os.getenv("DB_USER") or os.getenv("POSTGRES_USER", "admin")
DB_PASSWORD = os.getenv("DB_PASSWORD") or os.getenv("POSTGRES_PASSWORD", "")
DB_ENGINE = "django.contrib.gis.db.backends.postgis" if USE_GIS else "django.db.backends.postgresql"

# ========= INSTALLED_APPS / MIDDLEWARE =========
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
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",  # CORS は CommonMiddleware より前
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# Admin が要求する DjangoTemplates backend
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

# ========= データベース（DATABASE_URL があれば優先）=========
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",  # デフォルトはローカル簡易DB
        "NAME": os.path.join(BASE_DIR, "db.sqlite3"),
        "USER": DB_USER,
        "PASSWORD": DB_PASSWORD,
        "HOST": DB_HOST,
        "PORT": DB_PORT,
        "CONN_MAX_AGE": 60,
        "OPTIONS": {"connect_timeout": 5},
        "TEST": {"NAME": f"test_{DB_NAME}"},
    }
}
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL:
    db = dj_database_url.parse(DATABASE_URL, conn_max_age=600)
    # postgis:// で来たら ENGINE を GIS backend に差し替える
    if DATABASE_URL.startswith("postgis://"):
        db["ENGINE"] = "django.contrib.gis.db.backends.postgis"
    DATABASES["default"] = db

# CI / pytest 向けの微調整
if os.getenv("CI") == "true":
    DATABASES["default"]["CONN_MAX_AGE"] = 0
elif IS_PYTEST and not DISABLE_GIS_FOR_TESTS:
    DATABASES["default"]["ENGINE"] = "django.contrib.gis.db.backends.postgis"

# ========= INSTALLED_APPS に GIS を追加 =========
if os.getenv("CI") == "true" or (IS_PYTEST and not DISABLE_GIS_FOR_TESTS) or USE_GIS:
    if "django.contrib.gis" not in INSTALLED_APPS:
        pos = (
            INSTALLED_APPS.index("django.contrib.postgres") + 1
            if "django.contrib.postgres" in INSTALLED_APPS
            else len(INSTALLED_APPS)
        )
        INSTALLED_APPS.insert(pos, "django.contrib.gis")

# ========= 静的/メディア =========
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# === Locale / Timezone ===
LANGUAGE_CODE = "ja"
TIME_ZONE = "Asia/Tokyo"
USE_I18N = True
USE_TZ = True

# ========= DRF =========
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ),
    # ✅ スロットルはここに（Scoped + 任意で anon/user）
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.ScopedRateThrottle",
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ),
    # ✅ スコープに geocode / route を追加（ここが無くて500）
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
    },
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.AllowAny",),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
}
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "throttle-cache",
    }
}

# ========= Google API keys（任意）=========
AUTO_GEOCODE_ON_SAVE = os.getenv("AUTO_GEOCODE_ON_SAVE", "0").lower() in ("1", "true", "yes")
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")
GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "") or GOOGLE_MAPS_API_KEY


# ========= Hosts / CORS =========
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
