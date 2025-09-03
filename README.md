# AI参拝ナビ（MVP）

## 概要

**AI参拝ナビ** は、ユーザーの現在地・希望するご利益・移動手段をもとに、AIコンシェルジュが最適な神社ルートを提案してくれるアプリです。

徒歩や車に応じたルート表示や、周辺の人気神社の自動推薦にも対応。さらに「干支」や「四柱推命」を活用したスピリチュアル要素を盛り込み、ユーザーにあった神社参拝体験をガイドします。

参拝体験を記録する「御朱印投稿」や「ランキング機能」も補助機能として備え、参拝をより楽しく、便利にすることを目指します。

## 使用技術

### バックエンド
- **Django 5 + DRF + PostgreSQL (PostGIS)**

### フロントエンド
- **React / Next.js**（Expoでモバイル対応）
- **shadcn/ui + Tailwind CSS**（和風×モダンのUIテーマ）

### AIレイヤー
- **OpenAI Responses API**（Structured Outputs）
- 干支・四柱推命診断ロジック

### 外部サービス
- Google Maps / Places (New) API
- Google Routes API
- Mapbox（徒歩＝青・車＝赤 のルート線描画）
- AWS（RDS (Postgres/PostGIS), S3, ECS/Fargate）

## コア機能（AI参拝ナビ）

### 🧭 AI参拝ナビ
- ご利益と移動手段を入力 → AIが神社ルートを提案
- メイン神社＋近隣2か所をまとめて表示

### 🔮 コンシェルジュ提案
- **ライト診断**（干支ベース）：生まれ年から相性の良い神社を提案
- **本格診断**（四柱推命ベース）：命式から不足五行や吉方位を考慮した神社を提案
- コンシェルジュメッセージで「案内されている感」を演出

### 🗺 ルート表示
- 徒歩＝青・車＝赤のルート線
- 現在地からの最短経路を算出

### ⛩ 人気神社推薦
- 閲覧数・イイネ数から30日間スコアを計算
- 自然にルート提案へ組み込み

## サポート機能

- 📸 **御朱印投稿**（画像アップロード／公開切替／編集／削除）
- ⭐ **お気に入り神社リスト**（追加・削除・一覧取得）
- 📊 **ランキング**（月間・年間TOP10／バッチ集計）
- 🔐 **ユーザー認証／設定**（JWT・公開切替・ニックネーム変更）

## ディレクトリ構成

```
jinja_app/
├── backend/                  # Django + DRF
│   ├── shrine_project/       # 設定ファイル
│   ├── temples/              # Shrine / Goshuin / AIナビ / Ranking API
│   ├── users/                # ユーザー認証・設定
│   ├── media/                # 御朱印画像（S3連携予定）
│   └── manage.py
│
├── frontend/                 # React/Next.js (Expo対応)
│   ├── app/                  # Next.js App Router ページ
│   ├── components/           # ShrineCard / GoshuinCard / MapRoute / UI
│   ├── lib/                  # APIクライアント
│   ├── styles/               # Tailwindベースのテーマ
│   └── public/               # 静的ファイル
│
├── infra/                    # Docker / デプロイ設定
│   ├── docker-compose.yml
│   ├── Dockerfile.web
│   ├── Dockerfile.frontend
│   ├── .env.dev
│   └── .env.prod.example
│
├── docs/                     # ドキュメント・ワイヤーフレーム
└── tests/                    # E2Eテスト
```

## 開発環境セットアップ

```bash
# 環境設定ファイルをコピー
cp .env.example .env.dev

# Dockerコンテナ起動
docker compose --env-file .env.dev up -d

# マイグレーション実行
docker compose exec web python manage.py migrate

# 管理ユーザー作成
docker compose exec web python manage.py createsuperuser

# フロントエンド起動
cd frontend
npm install
npm run dev
```

## Windows: Miniforge + conda-forge（GDAL/Geo スタック推奨）

GDAL, pyproj, shapely, fiona, geopandas など地理系は **pip/venv だと Windows で詰まりやすい**ため、Miniforge + conda-forge を推奨します。

### 1) Miniforge の初期化
PowerShell:
```powershell
& "$env:USERPROFILE\Miniforge3\Scripts\conda.exe" init powershell
# いったん PowerShell を閉じて開き直す
conda --version

## Git Bash
"$HOME/Miniforge3/Scripts/conda.exe" init bash
exec -l "$SHELL"
conda --version

## アクセス先

- **管理画面**: http://localhost:8000/admin/
- **API**: http://localhost:8000/api/shrines/
- **フロントエンド**: http://localhost:3000/

## 今後の拡張予定

- 多言語対応（英語／中国語）
- Push通知（参拝リマインダー）
- SNS共有（Instagram/TikTok）
- 御朱印帳クラウド同期
- ランキングバッチ処理（自動集計・ログ保存）
- コンシェルジュAIの強化（干支→四柱推命→吉方位へ拡張）

### Windows: Miniforge + conda-forge
```powershell
conda create -n jinja_app_py311 -c conda-forge python=3.11 gdal pyproj shapely fiona geopandas rtree -y
conda activate jinja_app_py311
python -c "from osgeo import gdal; print('GDAL VersionInfo:', gdal.VersionInfo())"

## Backend tests:
  docker compose exec -T web pytest -q
