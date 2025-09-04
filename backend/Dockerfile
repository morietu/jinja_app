FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

# OSレイヤ（GDAL/GEOS/PROJ + psql クライアント）
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    build-essential gdal-bin libgdal-dev libgeos-dev proj-bin libproj-dev postgresql-client ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Python: pip更新 & GDAL は OS の gdal-config に合わせる
RUN python -m pip install --upgrade pip
RUN GDAL_VER="$(gdal-config --version)" \
 && python -m pip install "GDAL==${GDAL_VER}.*"

# 依存関係（backend 配下を前提）
COPY backend/requirements.txt /app/requirements.txt
RUN pip install -r /app/requirements.txt

# （任意）テスト用依存があるならインストール
#   ない場合はこの2行はコメントアウトのままでOK
# COPY backend/requirements-dev.txt /app/requirements-dev.txt
# RUN pip install -r /app/requirements-dev.txt || true

# アプリ本体
COPY backend/ /app/

EXPOSE 8000
CMD sh -c "python manage.py migrate && python manage.py runserver 0.0.0.0:8000"
