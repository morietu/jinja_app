from pathlib import Path
import os
import environ

BASE_DIR = Path(__file__).resolve().parent.parent

# .env.dev を読み込む
env = environ.Env()
environ.Env.read_env(BASE_DIR / ".env.dev")

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'django-insecure-...')
DEBUG = os.getenv("DJANGO_DEBUG", "False") == "True"

ALLOWED_HOSTS = os.getenv("DJANGO_ALLOWED_HOSTS", "*").split(",")
CSRF_TRUSTED_ORIGINS = (
    os.getenv("DJANGO_CSRF_TRUSTED_ORIGINS", "").split(",")
    if os.getenv("DJANGO_CSRF_TRUSTED_ORIGINS") else []
)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# --- INSTALLED_APPS ---
INSTALLED_APPS = [
    # Django
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # サードパーティ
    'csp',
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',

    # Local apps
    'users',
    'temples',
    # 今後追加予定
    # 'maps',
    # 'concierge',
    # 'common',
]

# --- MIDDLEWARE ---
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'csp.middleware.CSPMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',   # Common より前
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

CORS_ALLOWED_ORIGINS = ['http://127.0.0.1:8001', 'http://localhost:8001']
CORS_ALLOW_CREDENTIALS = True

# --- 開発向けの緩めCSP（本番は unsafe-* を外すの推奨） ---
if DEBUG:
    CSP_DEFAULT_SRC = ("'self'",)
    CSP_SCRIPT_SRC = (
        "'self'",
        "https://maps.googleapis.com",
        "https://maps.gstatic.com",
        "'unsafe-inline'",
        "'unsafe-eval'",
    )
    CSP_IMG_SRC = ("'self'", "data:", "https://*.googleapis.com", "https://*.gstatic.com", "https://*.google.com")
    CSP_STYLE_SRC = ("'self'", "'unsafe-inline'", "https://fonts.googleapis.com")
    CSP_FONT_SRC = ("'self'", "https://fonts.gstatic.com")
    CSP_CONNECT_SRC = (
        "'self'",
        "https://maps.googleapis.com",
        "https://maps.gstatic.com",
    )

ROOT_URLCONF = 'shrine_project.urls'
WSGI_APPLICATION = 'shrine_project.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DJANGO_DB_NAME', 'shrine_db'),
        'USER': os.getenv('DJANGO_DB_USER', 'shrine_user'),
        'PASSWORD': os.getenv('DJANGO_DB_PASSWORD', 'shrine_pass'),
        'HOST': os.getenv('DJANGO_DB_HOST', 'db'),
        'PORT': os.getenv('DJANGO_DB_PORT', '5432'),
    }
}

LANGUAGE_CODE = "ja"
TIME_ZONE = "Asia/Tokyo"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

TEMPLATES = [
  {
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [],
    'APP_DIRS': True,
    'OPTIONS': {
        'context_processors': [
            "django.template.context_processors.debug",
            'django.template.context_processors.request',
            "django.template.context_processors.static",
            'django.contrib.auth.context_processors.auth',
            'django.contrib.messages.context_processors.messages',
            "shrine_project.context_processors.maps_api_key",
        ],
    },
}]

LOGIN_REDIRECT_URL = "mypage"
LOGOUT_REDIRECT_URL = "/"

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")
GOOGLE_MAPS_MAP_ID  = os.getenv("GOOGLE_MAPS_MAP_ID", "DEMO_MAP_ID")

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}

CORS_ALLOWED_ORIGINS = [
    'http://127.0.0.1:8001',
    'http://localhost:8001',
]
CORS_ALLOW_CREDENTIALS = True

AUTH_USER_MODEL = "users.User"

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'file': {
            'level': 'DEBUG',
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / "logs" / "django.log",
        },
        "console": {
            "level": "DEBUG",
            "class": "logging.StreamHandler",
        },
    },
    'root': {
        'handlers': ['file', "console"],
        'level': 'DEBUG',
    },
}

from pprint import pprint
pprint(DATABASES["default"])
