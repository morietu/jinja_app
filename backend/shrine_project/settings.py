# backend/shrine_project/settings.py
import os
import sys
from datetime import timedelta
from pathlib import Path

from corsheaders.defaults import default_headers, default_methods
from dotenv import load_dotenv


def _is_pytest() -> bool:
    # 環境変数 or コマンドラインの両方で検知
    if os.getenv("PYTEST_CURRENT_TEST"):
        return True
    argv = " ".join(sys.argv).lower()
    return ("pytest" in argv) or ("py.test" in argv)


IS_PYTEST = _is_pytest()


# 運用で切替しやすいように
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


BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")

# 既存の環境変数を優先しつつ、最初に見つかった .env を読む
for name in (".env.local", ".env.dev", ".env"):
    p = BASE_DIR / name
    if p.exists():
        load_dotenv(p, override=True)  # 既に export 済みの値は上書きしない
        os.environ.setdefault("ENV_FILE", str(p))  # どれを読んだかメモ
        break
# ← .env 読み込みが終わった“後”で評価
ENABLE_LUCK_BONUS = _env_bool("ENABLE_LUCK_BONUS", True)
LUCK_BONUS_POINT = _env_float("LUCK_BONUS_POINT", 10.0)
LUCK_BASE_FIELD = "popular_score"  # スコアのベースに使うフィールド
LUCK_FLAG_FIELD = ""  # 真偽フラグが無いので空（= 未使用）
LUCK_BONUS_ELEMENT = "金運"  # element が一致したらボーナス付与
# 予備: ID 指定で強制付与したい場合
LUCK_BONUS_IDS = []  # 例: [2, 99]

if sys.platform == "darwin":
    # macOS (Homebrew) 環境: GeoDjango が確実に見つけられるようヒントを付与
    os.environ.setdefault("GDAL_DATA", "/opt/homebrew/share/gdal")
    os.environ.setdefault("PROJ_LIB", "/opt/homebrew/share/proj")
    GDAL_LIBRARY_PATH = "/opt/homebrew/opt/gdal/lib/libgdal.dylib"
    GEOS_LIBRARY_PATH = "/opt/homebrew/opt/geos/lib/libgeos_c.dylib"

# ========= パス =========
BASE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BASE_DIR.parent

# ========= conda 環境の DLL / データパス =========
_CONDA_PREFIX = Path(sys.prefix)  # 例: C:\Users\user\Miniforge3\envs\jinja_app_py311
_DLL_DIR = _CONDA_PREFIX / "Library" / "bin"
_GDAL_DATA_D = _CONDA_PREFIX / "Library" / "share" / "gdal"
_PROJ_LIB_D = _CONDA_PREFIX / "Library" / "share" / "proj"


# ========= .env の読込（最初に1回だけ。OS環境変数を優先: override=True）=========
# for candidate in (REPO_ROOT / ".env.dev", REPO_ROOT / ".env"):
# if candidate.exists():
# try:
# from dotenv import load_dotenv  # optional

# load_dotenv(dotenv_path=candidate, override=True)
# except Exception:
# pass
# IS_PYTEST = "PYTEST_CURRENT_TEST" in os.environ
# ← ここで定義に移動（.envを読んだ“後”に評価）
# USE_GIS = os.getenv("USE_GIS", "0") == "1"


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


IS_PYTEST = IS_PYTEST  # 上で定義済み


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

if IS_PYTEST:
    # ✅ pytest 中は常に Spatialite（GeoDjango 有効）
    DATABASES = {
        "default": {
            "ENGINE": "django.contrib.gis.db.backends.spatialite",
            "NAME": str(BASE_DIR / "test_gis.sqlite3"),
        }
    }
    # macOS Homebrew 既定の場所をデフォルトに
    if sys.platform == "darwin":
        SPATIALITE_LIBRARY_PATH = os.environ.get(
            "SPATIALITE_LIBRARY_PATH", "/opt/homebrew/lib/mod_spatialite.dylib"
        )
    else:
        SPATIALITE_LIBRARY_PATH = os.environ.get("SPATIALITE_LIBRARY_PATH", "mod_spatialite.so")
else:
    if USE_GIS:
        # ✅ 本番/開発で GIS を使うとき（PostGIS）
        DATABASES = {
            "default": {
                "ENGINE": "django.contrib.gis.db.backends.postgis",
                "NAME": "jinja_app",
                "USER": "",
                "PASSWORD": "",
                "HOST": "127.0.0.1",
                "PORT": "5432",
                "CONN_MAX_AGE": 60,
                "OPTIONS": {"connect_timeout": 5},
            }
        }
    else:
        # ✅ 通常の PostgreSQL（GIS なし）
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


# ========= 効いている設定の確認（必要時のみ）=========
if os.getenv("PRINT_EFFECTIVE_SETTINGS") == "1":
    print(f"[settings] DB_HOST={DB_HOST} REDIS_URL={REDIS_URL}", flush=True)

# ========= GDAL/GEOS の DLL ヒント（Windows のみ）=========
if sys.platform == "win32":
    from pathlib import Path

    _CONDA_PREFIX = Path(sys.prefix)
    _DLL_DIR = _CONDA_PREFIX / "Library" / "bin"

    if hasattr(os, "add_dll_directory"):
        if _DLL_DIR.exists():
            os.add_dll_directory(str(_DLL_DIR))
        _DLL_HINT = os.getenv("GDAL_DLL_DIR")
        if _DLL_HINT and os.path.isdir(_DLL_HINT):
            os.add_dll_directory(_DLL_HINT)

    # （任意）デバッグ用の存在確認。未発見でも問題なし
    _has_gdal_dll = any(_DLL_DIR.glob("gdal*.dll"))


# Django が参照する設定値
# 既に上でプラットフォーム別の既定を与えているので、
# 「環境変数があれば上書き、無ければ既定を残す」合流ロジックにする
GDAL_LIBRARY_PATH = os.getenv(
    "GDAL_LIBRARY_PATH",
    globals().get("GDAL_LIBRARY_PATH"),  # 例: macOS Homebrew の既定
)
GEOS_LIBRARY_PATH = os.getenv("GEOS_LIBRARY_PATH", globals().get("GEOS_LIBRARY_PATH"))
# GDAL_DATA / PROJ_LIB は基本は環境変数で渡す想定。
# Windows(Conda) では該当ディレクトリが存在すればフォールバック。
_env_gdal_data = os.getenv("GDAL_DATA")
_env_proj_lib = os.getenv("PROJ_LIB")
if not _env_gdal_data and sys.platform == "win32" and _GDAL_DATA_D.exists():
    _env_gdal_data = str(_GDAL_DATA_D)
if not _env_proj_lib and sys.platform == "win32" and _PROJ_LIB_D.exists():
    _env_proj_lib = str(_PROJ_LIB_D)
# 参考: これらは settings 変数として持つ必要はないが、デバッグ用に保持してもOK
GDAL_DATA = _env_gdal_data
PROJ_LIB = _env_proj_lib

# ========= 基本設定 =========
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "django-insecure-dev-key")
DEBUG = True
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "[::1]"]

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

# ========= DRF / 認可 =========
PLACES_THROTTLE_BURST = os.getenv("PLACES_THROTTLE_BURST", "30/min")
PLACES_THROTTLE_SUSTAIN = os.getenv("PLACES_THROTTLE_SUSTAIN", "1000/day")
PLACES_TEXT_DEFAULT_LOCATION = "35.71,139.80"  # "lat,lng" 文字列
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
            # places はテストで確実に 429 を検出できるよう低く固定
            "places": os.getenv("THROTTLE_PLACES_TEST", "1/min"),
        }
    )


SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=1),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}


AUTH_USER_MODEL = "auth.User"  # 規定ユーザーに戻す

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

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:19006",
    "http://127.0.0.1:19006",
    "http://localhost:8081",
    "http://127.0.0.1:8081",
]
# CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
CORS_ALLOW_CREDENTIALS = True

CORS_ALLOW_HEADERS = list(default_headers) + [
    "authorization",
    "content-type",
]
CORS_ALLOW_METHODS = list(default_methods)

# ========= OpenAI =========
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")


# ----------------------------------------
# Cache 設定（pytest中は LocMem を強制、普段は REDIS_URL があり redis クライアントが入っていれば Redis）
# ----------------------------------------
def _build_cache():
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


# --- logging ---
DJANGO_LOG_LEVEL = os.getenv("DJANGO_LOG_LEVEL", "INFO")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {"class": "logging.StreamHandler"},
    },
    # ルートロガー（全体の標準出力）
    "root": {
        "handlers": ["console"],
        "level": DJANGO_LOG_LEVEL,
    },
    "loggers": {
        # temples.* 配下（temples.services.places も含む）を INFO 以上で出力
        "temples": {
            "handlers": ["console"],
            "level": DJANGO_LOG_LEVEL,
            "propagate": False,
        },
    },
}

AUTO_GEOCODE_ON_SAVE = os.getenv("AUTO_GEOCODE_ON_SAVE", "1") == "1"
GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY") or os.getenv("GOOGLE_MAPS_API_KEY")


DEBUG = os.getenv("DJANGO_DEBUG", "1") == "1"  # ここだけで管理

# 既存の設定を上書き（開発時のみ）
if DEBUG:
    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SECURE = False
    # Secure=False のとき SameSite=None はブラウザに拒否されるため Lax へ
    SESSION_COOKIE_SAMESITE = "Lax"
    CSRF_COOKIE_SAMESITE = "Lax"
else:
    # 本番は必ず Secure+None
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SESSION_COOKIE_SAMESITE = "None"
    CSRF_COOKIE_SAMESITE = "None"


TESTING = "PYTEST_CURRENT_TEST" in os.environ

# pytest 実行時は自動ジオコーディングを無効化して外部API呼び出しを防ぐ
if IS_PYTEST:
    AUTO_GEOCODE_ON_SAVE = False
