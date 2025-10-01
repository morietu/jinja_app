import os
import sys
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

# ========= パス =========
BASE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BASE_DIR.parent


# ========= .env を最優先で読み込む =========
for name in (".env.local", ".env.dev", ".env"):
    p = REPO_ROOT / name if (REPO_ROOT / name).exists() else BASE_DIR / name
    if p.exists():
        load_dotenv(p, override=True)
        os.environ.setdefault("ENV_FILE", str(p))
        break
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY") or "django-insecure-dev-key"


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
USE_GIS = os.getenv("USE_GIS", "0").lower() in ("1", "true", "yes")
ENGINE = "django.contrib.gis.db.backends.postgis" if USE_GIS else "django.db.backends.postgresql"
DISABLE_GIS_FOR_TESTS = os.getenv("DISABLE_GIS_FOR_TESTS", "0") == "1"

# ========= macOS GDAL/GEOS ヒント =========
if sys.platform == "darwin":
    os.environ.setdefault("GDAL_DATA", "/opt/homebrew/share/gdal")
    os.environ.setdefault("PROJ_LIB", "/opt/homebrew/share/proj")
    GDAL_LIBRARY_PATH = "/opt/homebrew/opt/gdal/lib/libgdal.dylib"
    GEOS_LIBRARY_PATH = "/opt/homebrew/opt/geos/lib/libgeos_c.dylib"

# Windows フォールバック
_CONDA_PREFIX = Path(sys.prefix)
_DLL_DIR = _CONDA_PREFIX / "Library" / "bin"
_GDAL_DATA_D = _CONDA_PREFIX / "Library" / "share" / "gdal"
_PROJ_LIB_D = _CONDA_PREFIX / "Library" / "share" / "proj"

# ========= DB 環境変数 =========
DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME") or os.getenv("POSTGRES_DB", "jinja_db")
DB_USER = os.getenv("DB_USER") or os.getenv("POSTGRES_USER", "admin")
DB_PASSWORD = os.getenv("DB_PASSWORD") or os.getenv("POSTGRES_PASSWORD", "")
DATABASE_URL = os.getenv("DATABASE_URL")

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
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # CORS はドキュメント上、CommonMiddleware より前に置くのが推奨
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",  # ← 必須（E410）
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",  # ← 必須（E408）
    "django.contrib.messages.middleware.MessageMiddleware",  # ← 必須（E409）
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
# Admin が要求する DjangoTemplates backend
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",  # ← 必須（E403）
        "DIRS": [BASE_DIR / "templates"],  # なくても動くが作っておくと便利
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


# ========= データベース設定 =========
if os.getenv("CI") == "true":
    # CI は必ず PostGIS
    DATABASES = {
        "default": {
            "ENGINE": "django.contrib.gis.db.backends.postgis",
            "NAME": DB_NAME,
            "USER": DB_USER,
            "PASSWORD": DB_PASSWORD,
            "HOST": DB_HOST,
            "PORT": DB_PORT,
            "CONN_MAX_AGE": 0,
            "OPTIONS": {"connect_timeout": 5},
            "TEST": {"NAME": f"test_{DB_NAME}"},
        }
    }

db_url = os.getenv("DATABASE_URL")

DATABASES = {}

if db_url:
    DATABASES = {"default": dj_database_url.parse(db_url, conn_max_age=0)}
    # PostGIS スキームならエンジンを postgis に
    if db_url.startswith("postgis://"):
        DATABASES["default"]["ENGINE"] = "django.contrib.gis.db.backends.postgis"

# CI では絶対に Spatialite を使わない
if os.getenv("CI") != "true" and os.getenv("TESTING", "").lower() in ("1", "true", "yes"):
    # ローカルの「軽い」テストだけ Spatialite に切り替える
    DATABASES["default"] = {
        "ENGINE": "django.contrib.gis.db.backends.spatialite",
        "NAME": str(BASE_DIR / "test_spatialite.sqlite3"),
    }
    SPATIALITE_LIBRARY_PATH = os.getenv(
        "SPATIALITE_LIBRARY_PATH",
        "/usr/local/lib/mod_spatialite.dylib",
    )


elif IS_PYTEST and not DISABLE_GIS_FOR_TESTS:
    # pytest でも GIS を使う
    DATABASES = {
        "default": {
            "ENGINE": "django.contrib.gis.db.backends.postgis",
            "NAME": DB_NAME,
            "USER": DB_USER,
            "PASSWORD": DB_PASSWORD,
            "HOST": DB_HOST,
            "PORT": DB_PORT,
            "CONN_MAX_AGE": 0,
            "OPTIONS": {"connect_timeout": 5},
            "TEST": {"NAME": f"test_{DB_NAME}"},
        }
    }

elif DATABASE_URL:
    # すでに上で db_url を適用済みなのでここは通らない想定。残すなら同義にしておく。
    DATABASES = {"default": dj_database_url.parse(DATABASE_URL, conn_max_age=600)}

elif USE_GIS:
    DATABASES = {
        "default": {
            "ENGINE": "django.contrib.gis.db.backends.postgis",
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
else:
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

# ========= INSTALLED_APPS に GIS を追加 =========
if os.getenv("CI") == "true" or (IS_PYTEST and not DISABLE_GIS_FOR_TESTS) or USE_GIS:
    if "django.contrib.gis" not in INSTALLED_APPS:
        insert_pos = (
            INSTALLED_APPS.index("django.contrib.postgres") + 1
            if "django.contrib.postgres" in INSTALLED_APPS
            else len(INSTALLED_APPS)
        )
        INSTALLED_APPS.insert(insert_pos, "django.contrib.gis")

# （任意だが推奨）
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
# STATICFILES_DIRS = [BASE_DIR / "static"]
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"


# DRF 認証を定義
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.AllowAny",),
    # スロットル（スコープ単位）
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.ScopedRateThrottle",
        # （任意）ここに Anon/User を入れておくと View 側で毎回指定しなくてよい
        # "rest_framework.throttling.AnonRateThrottle",
        # "rest_framework.throttling.UserRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        # テストで 429 が出ることだけ保証したいなら少し小さめでもOK
        "anon": "60/min",  # ← これが無くて落ちていた
        "user": "120/min",  # （保険）UserRateThrottle 用
        "concierge": "60/min",  # ← これも無くて落ちていた
        "places": "30/min",  # 既存
        # View で他に throttle_scope を使っていればここに追加
        # "places_search": "30/min",
        # "places_detail": "30/min",
    },
}

# --- Geocoding toggle (default: OFF for tests/CI) ---
AUTO_GEOCODE_ON_SAVE = os.getenv("AUTO_GEOCODE_ON_SAVE", "0").lower() in ("1", "true", "yes")
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")
