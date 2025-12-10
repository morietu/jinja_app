# インフラ構成 / デプロイ手順

## ゴール

- `main` ブランチにマージすると、以下が自動デプロイされる状態にする
  - Frontend (Next.js) → Vercel
  - Backend (Django) → Render
- フロントからバックエンド API を叩いて、実際のデータで画面を確認できる

---

## 全体構成（ざっくり）

- フロントエンド
  - フレームワーク: Next.js (`apps/web`)
  - ホスティング: Vercel
- バックエンド
  - フレームワーク: Django (`backend`)
  - ホスティング: Render Web Service
- データベース
  - Render PostgreSQL
- CI
  - GitHub Actions
  - 実行内容（例）: ESLint / Vitest / TypeScript / Django tests など

---

## 使用サービスと役割

| サービス | 用途 | 備考 |
| --- | --- | --- |
| GitHub | ソースコード管理 | リポジトリ: `TODO: org/name` |
| Render | Django + Postgres をホスト | `backend` ディレクトリを Web Service としてデプロイ |
| Render PostgreSQL | 本番 DB | `DATABASE_URL` を Django に渡す |
| Vercel | Next.js アプリをホスト | `apps/web` をプロジェクトとして設定 |
| GitHub Actions | テスト・Lint | `main` / `pull_request` で実行 |

---

## 1. アカウント・初期設定

### 1-1. Render アカウント作成

1. https://render.com にアクセス
2. GitHub アカウントでサインアップ / ログイン
3. GitHub リポジトリ `jinja_app` へのアクセス権を付与

> NOTE: セキュリティのため、不要なリポジトリへのアクセスは外しておく。

### 1-2. Vercel アカウント作成

1. https://vercel.com にアクセス
2. GitHub アカウントでサインアップ / ログイン
3. 同じく `jinja_app` へのアクセスを許可

---

## 2. Render で PostgreSQL を作成

1. Render ダッシュボード → **New +** → **PostgreSQL**
2. 設定例
   - Name: `jinja-db`
   - Region: `TODO: 選んだリージョン（例: Singapore）`
   - Plan: Free / Starter（初期は Free 想定）
3. 作成後、**接続情報を控える**
   - `DATABASE_URL`
   - `HOST / USER / PASSWORD / DB / PORT`
4. `DATABASE_URL` は後で Django の環境変数に設定する

---

## 3. Render で Django バックエンドをデプロイ

### 3-1. Web Service 作成

1. Render ダッシュボード → **New +** → **Web Service**
2. GitHub から `jinja_app` リポジトリを選択
3. 設定
   - Name: `jinja-backend`（例）
   - Root directory: `backend`
   - Runtime: Python
   - Build Command（例）:
     ```bash
     pip install -r requirements.txt
     python manage.py collectstatic --noinput
     python manage.py migrate
     ```
   - Start Command（例）:
     ```bash
     gunicorn config.wsgi:application --bind 0.0.0.0:8000
     ```

### 3-2. 環境変数

Render の Web Service の **Environment** に設定する：

- `DJANGO_SECRET_KEY=TODO: ランダム文字列`
- `DJANGO_DEBUG=false`
- `DATABASE_URL=TODO: 上で控えた Postgres の URL`
- `ALLOWED_HOSTS=.onrender.com,.vercel.app`
- 必要に応じて
  - `CSRF_TRUSTED_ORIGINS=https://*.onrender.com,https://*.vercel.app`
  - その他、既存 `.env` 相当の値

### 3-3. 動作確認

- Render がデプロイ完了後、発行された URL で簡易確認
  - 例: `https://jinja-backend.onrender.com/api/health/`
- 200 が返ればOK

---

## 4. Vercel で Next.js フロントをデプロイ

### 4-1. プロジェクト作成

1. Vercel ダッシュボード → **Add New → Project**
2. `jinja_app` リポジトリを選択
3. 設定
   - Framework: Next.js
   - Root Directory: `apps/web`
   - Build Command: デフォルト（変更なし）
   - Output Directory: `.next`（デフォルト）

### 4-2. 環境変数

Vercel プロジェクトの **Environment Variables** に設定：

- `NEXT_PUBLIC_API_BASE_URL=https://jinja-backend.onrender.com`
  - 実際の Render URL に合わせて変更
- その他、フロント側で参照している env があれば追加

### 4-3. 初回デプロイ確認

- Vercel が自動でビルド＆デプロイ
- 発行された URL で以下を確認：
  - `/` が開く
  - ログイン後 `/mypage` などが API にアクセスできている

---

## 5. GitHub Actions / デプロイフロー

### 5-1. ブランチ運用

- `main`
  - 本番デプロイ対象ブランチ
- `feat/...`
  - 機能追加用ブランチ（例: `feat/web-public-profile-link-from-mypage`）
- `chore/...`
  - インフラ・設定変更など（例: `chore/infra-basic-deploy`）

### 5-2. CI（GitHub Actions）の役割

- トリガー：
  - `pull_request`（`main` 向け）
  - `push` to `main`
- 実行するジョブ例：
  - `apps/web`:
    - `pnpm exec eslint . --cache --cache-location .eslintcache`
    - `pnpm test:contract`
    - `pnpm exec tsc -p tsconfig.json --noEmit`
  - `backend`:
    - `pytest`
    - `mypy`（必要なら）

> `main` にマージされる PR は、基本的に **全ジョブ green** を前提にする。

### 5-3. デプロイ連携

- `main` に push されると：
  - Render: Web Service が自動リデプロイ
  - Vercel: Project の Production デプロイ

- PR を作成すると：
  - Vercel: Preview デプロイ URL が発行される
  - UI の確認やレビューに使用する

---

## 6. よくある操作メモ

### 6-1. バックエンドのマイグレーション

- コード変更 → `main` にマージ → Render の build コマンドで `migrate` 実行
- 手動でマイグレーションを打ちたい場合：
  - Render の Web Service → Shell（ある場合）から
    ```bash
    python manage.py migrate
    ```

### 6-2. 環境変数の変更

- Render / Vercel どちらも、環境変数を変更したら **再デプロイが必要**
- 機密情報（APIキーなど）は必ず env 経由で設定し、Git に含めない

---

## 7. TODO / 今後の拡張

- [ ] Render アカウント作成 + GitHub `jinja_app` 連携確認
- [ ] Render Web Service の Build / Start コマンドを確定して README に追記
- [ ] Render PostgreSQL の接続情報（DB 名 / ユーザー / ホストなど）を整理して追記
- [ ] Vercel / Render それぞれのログ画面 URL をメモ
- [ ] 料金試算（Render / Vercel / Postgres）を書き足す
- [ ] ステージング環境（stg 用 Render / Vercel プロジェクト）を分けるか検討
- [ ] カスタムドメインの追加（必要になったら）
- [ ] モニタリング・エラートラッキング（Sentry 等）の追加
