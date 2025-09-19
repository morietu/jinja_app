# AI参拝ナビ（MVP）

## 概要

**AI参拝ナビ** は、ユーザーの現在地・希望するご利益・移動手段をもとに、AIコンシェルジュが最適な神社ルートを提案するアプリです。

### 主な機能
- 徒歩/車のルート表示
- 周辺の人気神社推薦
- 「干支・四柱推命」などのスピ要素対応
- 御朱印投稿、ランキング等の補助機能

---

## 技術スタック

### バックエンド
- Django 5 + DRF + PostgreSQL (PostGIS)

### フロントエンド
- Next.js (App Router) / React
- Expo + React Native（モバイル）
- shadcn/ui + Tailwind CSS

### AIレイヤー
- OpenAI Responses API（Structured Outputs）
- 干支・四柱推命の簡易診断ロジック
- 失敗時は「距離順トップ3」のフォールバック

---

## アーキテクチャと認証の方針

### Cookie ベース認証
- HttpOnly クッキー：`access_token` / `refresh_token`
- Next の `/api` キャッチオール・プロキシで DRF に転送
- パス: `apps/web/src/app/api/[[...path]]/route.ts`
- `/api` を剥がさず Django 側へそのまま流す
- `access_token` が Cookie にあれば `Authorization: Bearer` を自動付与

### 認証フロー
- `POST /api/auth/jwt/(create|refresh)/` のレスポンスから HttpOnly Cookie を設定
- axios 統一：クライアント/サーバ共通で **必ず /api（Next 経由）** を叩く

### 重要なファイル
- `apps/web/src/lib/api/client.ts` - axios設定
- `apps/web/src/lib/api/http.ts` - apiGet/apiPost/apiPatch/apiDelete など薄いラッパ

### 重要ルール ⚠️
- API は **相対パスのみ**：`api.get("/users/me/")`（直 URL 禁止）
- `withCredentials: true`（axios）
- DRF はトレーリングスラッシュ必須（例：`/users/me/`）
- Authorization ヘッダは手動で付けない（プロキシが付ける）

---

## 主な API エンドポイント

### AI参拝ナビ
```
POST /api/concierge/chat/    # 会話入力 → LLM が最終プラン(JSON)を返す
POST /api/concierge/plan/    # フォーム入力（構造化）→ 参拝プラン(JSON)
```

### 神社データ取り込み
```
POST /api/shrines/import_from_place/    # { place_id, favorite?: true }
POST /api/shrines/bulk_import/          # { place_ids: string[] }
```
- `place_id` ユニークで重複登録を防止
- 成功時は（ログイン中なら）自動お気に入り追加

### デバッグ（Next プロキシ内）
```
GET /api/probe              # Next 側の死活＋ ORIGIN 表示
GET /api/debug/cookies      # Cookie/Authorization の確認
```

---

## 環境変数設定

### LLM 設定（.env）

```bash
# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini

# 推奨デフォルト
LLM_TEMPERATURE=0.2
LLM_CACHE_TTL_S=600
LLM_COORD_ROUND=3
LLM_RETRIES=2
LLM_BACKOFF_S=0.5
LLM_PROMPT_VERSION=v1
# LLM_ENABLE_PLACES=true  # Places補完を使う場合
```

### 設定説明
- **モデル**: `OPENAI_MODEL`（例: gpt-4.1-mini）
- **温度**: `LLM_TEMPERATURE`（既定 0.2）
- **キャッシュ**: `LLM_CACHE_TTL_S`（同一質問＋座標を再利用）
- **緯度経度の丸め**: `LLM_COORD_ROUND`
- **リトライ**: `LLM_RETRIES` / `LLM_BACKOFF_S`

---

## ディレクトリ構成

```
jinja_app/
├── backend/                            # Django + DRF
│   ├── shrine_project/                 # 設定
│   ├── temples/                        # Shrine / Goshuin / AIナビ / Ranking API
│   ├── users/                          # 認証・ユーザー設定
│   └── media/                          # 御朱印画像（S3連携予定）
│
├── apps/
│   ├── web/                            # Next.js (Web)
│   │   ├── src/app/api/[[...path]]/route.ts     # ← Next プロキシ
│   │   ├── src/lib/api/client.ts                # ← axios インスタンス（唯一の入口）
│   │   ├── src/lib/api/http.ts                  # ← axios ラッパ
│   │   ├── src/lib/api/{users,favorites,places,auth}.ts
│   │   ├── src/components/...
│   │   └── ...
│   └── mobile/                         # Expo (モバイル)
│
└── ...
```

---

## セットアップ（ローカル）

### バックエンド（Django）

```bash
# ルートから backend へ
cd backend

# 既存 venv があれば有効化
source ../.venv/bin/activate  # Windows は適宜

# 依存関係のインストール
pip install -r requirements.txt

# マイグレーション実行
python manage.py migrate

# サーバー起動 (127.0.0.1:8000)
python manage.py runserver 127.0.0.1:8000
```

### フロントエンド（Next.js）

```bash
cd apps/web
npm install
npm run dev   # http://localhost:3000
```

### Next.js 用の環境変数（.env.local）

```bash
APP_ORIGIN=http://localhost:3000
NEXT_PUBLIC_BACKEND_ORIGIN=http://127.0.0.1:8000
API_BASE_SERVER=http://127.0.0.1:8000
```

### モバイル（Expo）

```bash
cd apps/mobile
npm install
npm start
```

---

## axiosクライアント設定（統一）

### client.ts の設定

```javascript
// apps/web/src/lib/api/client.ts
import axios from "axios";

const api = axios.create({
  baseURL: "/api",            // ← Next のプロキシ必須
  withCredentials: true,      // ← Cookie を送る
  headers: { Accept: "application/json" },
});

export default api;
```

### 薄いラッパの例

```javascript
// apps/web/src/lib/api/http.ts
import api from "./client";
import type { AxiosRequestConfig } from "axios";

export async function apiGet<T>(url: string, config: AxiosRequestConfig = {}): Promise<T> {
  const { data } = await api.get<T>(url, config);
  return data;
}

// apiPost / apiPatch / apiDelete / isAuthError も同様
```

---

## 動作確認

### cURL を使った確認

```bash
# 1) プローブ確認
curl -s http://localhost:3000/api/probe | jq

# 2) ログイン（Cookie保存）
curl -i -c cookies.txt -H 'content-type: application/json' \
  -d '{"username":"admin","password":"***"}' \
  http://localhost:3000/api/auth/jwt/create/

# 3) Cookie確認
curl -s -b cookies.txt http://localhost:3000/api/debug/cookies | jq

# 4) ユーザー情報取得
curl -s -b cookies.txt http://localhost:3000/api/users/me/ | jq
```

### ブラウザコンソールでの確認

```javascript
// ログイン
await fetch('/api/auth/jwt/create/', {
  method:'POST',
  headers:{'content-type':'application/json'},
  credentials:'include',
  body: JSON.stringify({ username:'admin', password:'***' }),
});

// Cookie確認
await fetch('/api/debug/cookies', { credentials:'include' }).then(r=>r.json());

// ユーザー情報取得
await fetch('/api/users/me/', { credentials:'include' }).then(r=>r.json());
```

---

## 仕様・運用ルール（重要）

- ✅ **常に /api を叩く**（直 URL 禁止）
- ✅ `withCredentials: true`（axios）/ `credentials: 'include'`（fetch）
- ✅ **トレーリングスラッシュ必須**（DRF）
- ✅ Authorization は付けない（プロキシが access_token Cookie から付与）
- ✅ **失敗時のフォールバック**：OpenAI 失敗時は距離順トップ3

---

## 外部サービス

- Google Maps / Places (New) API
- Google Routes API
- Mapbox（徒歩＝青・車＝赤）
- AWS（RDS/PostGIS, S3, ECS/Fargate）※予定含む

---

## コア機能

### 🧭 AI参拝ナビ
- ご利益×移動手段から最適ルート提案
- メイン神社＋近隣2か所

### 🗺 ルート表示
- 徒歩＝青 / 車＝赤

### ⛩ 人気神社推薦
- 30日スコア

### ⭐ お気に入り管理

### 📸 御朱印投稿

### ➕ ユーザー神社登録
- ピン→名前→住所自動取得

### 🔮 コンシェルジュ提案
- **ライト診断**（干支）
- **本格診断**（四柱推命：不足五行・吉方位）

---

## テスト

```bash
# Docker 内
docker compose exec -T web pytest -q

# ローカルで最小実行
docker compose up -d db web
docker compose exec -T web sh -lc "pip install -q pytest pytest-django && pytest -q"
```

---

## 今後の拡張予定

- 多言語（英語／中国語）
- Push通知（参拝リマインダー）
- SNS 共有
- 御朱印帳クラウド同期
- ランキングの自動集計
- コンシェルジュ強化（干支→四柱推命→吉方位）

---

## Windows 参考情報

Geo スタックは conda-forge 推奨：

```bash
conda create -n jinja_app_py311 -c conda-forge ^
  python=3.11 gdal pyproj shapely fiona geopandas rtree -y
conda activate jinja_app_py311
python -c "from osgeo import gdal; print('GDAL VersionInfo:', gdal.VersionInfo())"
```
