# backend 用 (Debian slim 推奨)
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# OS依存ライブラリ: GDAL/GEOS/PROJ + Postgres client 等
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    build-essential \
    gdal-bin \
    libgdal-dev \
    libgeos-dev \
    proj-bin \
    libproj-dev \
    postgresql-client \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# OSの gdal バージョンに合わせて Python GDAL をインストール
# 例: gdal-config --version が 3.8.4 なら GDAL==3.8.*
RUN GDAL_VER="$(gdal-config --version)" \
    && python -m pip install --upgrade pip \
    && python -m pip install "GDAL==${GDAL_VER}.*"

# 依存インストール（requirements.txt は backend 直下想定なら、パス合わせ注意）
COPY requirements.txt /app/requirements.txt
RUN python -m pip install -r requirements.txt

# アプリ本体
COPY backend /app

EXPOSE 8000

# 起動（migrate → runserver）
CMD sh -c "python manage.py migrate && python manage.py runserver 0.0.0.0:8000"
