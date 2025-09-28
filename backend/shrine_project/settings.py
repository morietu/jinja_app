import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# ========= パス =========
BASE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BASE_DIR.parent
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY") or "django-insecure-dev-key"


# ========= .env を最優先で読み込む =========
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
USE_GIS = _env_bool("USE_GIS", False)
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
    try:
        import dj_database_url

        DATABASES = {"default": dj_database_url.parse(DATABASE_URL, conn_max_age=600)}
    except Exception:
        if DATABASE_URL.startswith("postgres"):
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
