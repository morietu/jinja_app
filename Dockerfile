# Dockerfile
FROM python:3.11-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# OS依存ライブラリ（psycopg2-binaryは不要だが、pipで入れるならbuild依存は軽めに）
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev curl postgresql-client && \
    rm -rf /var/lib/apt/lists/*

# 依存インストール（requirements.txt がある前提）
COPY requirements.txt /app/requirements.txt
RUN pip install --upgrade pip && pip install -r requirements.txt

# アプリ本体
COPY backend /app

EXPOSE 8000
# runserverはcompose側で指定するためCMDは空でも可
