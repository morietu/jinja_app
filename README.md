# AI参拝ナビ（MVP）統合ドキュメント

## 目次
1. [概要](#概要)
2. [主な機能](#主な機能)
3. [技術スタック](#技術スタック)
4. [セットアップ手順](#セットアップ手順)
5. [プロジェクト構成](#プロジェクト構成)
6. [重要ルール](#重要ルール)
7. [アーキテクチャ設計](#アーキテクチャ設計)
8. [公開御朱印の設計方針](#公開御朱印の設計方針)
9. [CI/Branch運用](#cibranch運用)

---

## 概要

**AI参拝ナビ**は、ユーザーの**現在地・ご利益・移動手段**から、参拝ルートとおすすめ神社を提案する**AIコンシェルジュアプリ**です。

Webを中心に開発し、将来的にMobile（Expo）へ展開予定です。

### AIの役割

- **自由会話は行いません**
- 相談文を1回解析し、意図（ご利益など）をJSONとして抽出します
- 神社の選定・距離計算・フォールバックはサーバー側で行います

### 御朱印機能

- 御朱印画像の保存
- 公開/非公開の切り替え
- 個人利用を主目的としています

---

## 主な機能

- 参拝ルート提案（徒歩/車）
- 周辺神社の推薦（人気・距離）
- AIコンシェルジュ（失敗時は距離順top3フォールバック）
- お気に入り/御朱印（補助機能）

---

## 技術スタック

### Backend
- Django 5 + Django REST Framework
- PostgreSQL + PostGIS

### Web
- Next.js（App Router）
- React
- shadcn/ui + Tailwind CSS

### Mobile
- Expo（WIP / 休眠運用あり）

### AI
-	OpenAI Responses API（任意・意図抽出用途のみ）
-	デフォルトではLLMは無効（CONCIERGE_USE_LLM=0）

---

## セットアップ手順

### Backend

```bash
cd backend
source ../.venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

export BILLING_STUB_PLAN=premium
python manage.py runserver

**Places API 新ルートを使う場合**
```bash
PLACES_API_NEW=1 python manage.py runserver 8000
```

### 起動時、プロジェクトルートでのコマンド
make dev

### Web

```bash
cd apps/web
pnpm install
pnpm dev

```

### アクセスURL

- Web: http://localhost:3000
- API: http://127.0.0.1:8000

> **注意**: WebからはAPIに`/api/...`経由でアクセスします

---

## プロジェクト構成

jinja_app/
├── backend/        # Django + DRF
├── apps/
│   ├── web/        # Next.js
│   └── mobile/     # Expo（WIP / 休眠運用あり）
└── docs/           # 設計・運用ドキュメント

### 主要ファイル構成（Web）

apps/web/src/app/
├── api/                    # BFF（Backend for Frontend）
│   ├── auth/              # 認証関連API
│   ├── concierge/         # コンシェルジュAPI
│   ├── favorites/         # お気に入りAPI
│   ├── goshuins/          # 御朱印API
│   ├── shrines/           # 神社API
│   └── users/             # ユーザーAPI
├── concierge/             # コンシェルジュページ
├── favorites/             # お気に入りページ
├── login/                 # ログインページ
├── map/                   # 地図ページ
├── mypage/                # マイページ
├── shrines/               # 神社詳細ページ
├── signup/                # サインアップページ
├── globals.css            # グローバルCSS
├── layout.tsx             # ルートレイアウト
└── page.tsx               # トップページ

---

## 重要ルール

### 通信/認証ルール

1. **WebからのAPI呼び出し**
   - 必ず`/api`（Next Route Handler / BFF）経由でAPIを叩く
   - バックエンド直URL禁止

2. **axios設定**
```javascript
   {
     baseURL: "/api",
     withCredentials: true
   }
```

3. **Django REST Framework**
   - trailing slash必須（例：`/users/me/`）

4. **認証**
   - Authorizationヘッダは手動で付けない
   - BFFがCookieから自動付与

### ファイル命名規則

- **クライアントコンポーネント**: `"use client"`を先頭に記述
- **サーバーコンポーネント**: デフォルト（指定不要）
- **API Route**: `route.ts`ファイル

---

## アーキテクチャ設計

### 認証フロー

ブラウザ → Next.js BFF → Django API
         ↓
    Cookie (HttpOnly)
    - access_token
    - refresh_token

1. ユーザーがログイン
2. BFFがDjangoからJWTトークンを取得
3. HttpOnly Cookieに保存
4. 以降のリクエストでBFFが自動でトークンをヘッダーに付与

### BFFパターン

Next.jsのRoute Handlerを使用して、以下を実現：

- **セキュリティ**: トークンをブラウザに露出しない
- **自動トークン管理**: 401エラー時の自動リフレッシュ
- **統一インターフェース**: フロントエンドは`/api/*`だけを意識

### 主要なBFF実装例

```typescript
// apps/web/src/app/api/favorites/route.ts
export async function GET(req: NextRequest) {
  return bffFetchWithAuthFromReq(req, "/api/favorites/", { 
    method: "GET" 
  });
}
```

---

## 公開御朱印の設計方針

### 基本方針

- 御朱印は**必ず神社に紐づくデータ**として扱う
- 「みんなの公開御朱印」一覧ページは**廃止**
- 他人の御朱印を閲覧できる場所は**神社詳細ページのみ**
- 公開/非公開は「表示範囲」の属性に留め、データ構造は共通
- 一覧性が必要なのは**自分用（マイページ）のみ**

### 設計判断の理由

- 御朱印は単体コンテンツではなく**神社体験の記録**である
- 横断的な公開一覧は文脈を失いやすく、設計負債になりやすい
- UI・APIが「神社単位」と「横断一覧」で二重化していたため、責務が曖昧だった

### 採用した構造

- `/api/public/goshuins`は**shrine指定必須**
- トップページ・公開御朱印一覧ページを削除
- from-place画面は**神社詳細ページへの踏み台**としてのみ使用

### 効果

- 情報構造が**神社 → 御朱印**に統一された
- UI/APIの責務が明確になった
- 将来の機能追加（評価、履歴、整理機能など）に耐えやすい構造になった

---

## Mobile（WIP / 休眠運用）

`apps/mobile/`は未着手〜プロトタイプ段階のため、通常はworkspaceから除外して運用します。

### 休眠中の目印
- `apps/mobile/.hibernated`

### 復帰手順（最小）

1. `pnpm-workspace.yaml`から`!apps/mobile`を外す
2. `apps/mobile`で`pnpm install`（必要なら`expo install`）
3. `expo start` / `expo run:*`を実行
4. Dependabot/CI対象の見直し

---

## CI/Branch運用

### 保護ブランチ

- `main`
- `develop`

### マージルール

- PR経由でのみマージ
- CI（backend / web）がすべてgreenであることが前提

### CI構成

- バックエンド: Django テスト
- フロントエンド: Next.js ビルド・テスト

詳細は`docs/40_infra_deploy.md`を参照してください。

---

## ドキュメント参照

詳細設計・運用ルールは`docs/`配下に集約しています。

- **アーキテクチャ/認証**: `docs/10_arch_auth_proxy.md`
- **ローカル動作確認**: `docs/20_smoke_checks.md`
- **API概要**: `docs/30_api_overview.md`
- **インフラ/デプロイ**: `docs/40_infra_deploy.md`
- **TODO/ロードマップ**: `docs/90_roadmap.md`
- **UI メモ**: `docs/ui/concierge_sp_notes.md`

---

## 主要画面説明

### トップページ（`/`）
- アプリの入り口
- コンシェルジュへの導線

### 地図ページ（`/map`）
- 近くの神社を地図で確認
- 現在地ベースの検索

### 神社詳細ページ（`/shrines/[id]`）
- 神社の詳細情報
- 公開御朱印の表示
- お気に入り保存機能

### コンシェルジュページ（`/concierge`）
- AIによる神社提案
- 相談フォーム形式での入力（自由会話なし）
- フィルター機能（生年月日、ご利益タグ）

### マイページ（`/mypage`）
- プロフィール設定
- お気に入り神社一覧
- 自分の御朱印管理

### お気に入りページ（`/favorites`）
- 保存した神社の一覧
- お気に入り解除機能

---

## 開発Tips

### デバッグ

1. **バックエンドログ確認**
```bash
   # Django開発サーバーのコンソール出力を確認
```

2. **フロントエンドログ確認**
```bash
   # ブラウザのDevToolsコンソール
   # Next.jsのターミナル出力
```

### LLMを有効にする場合（任意）

デフォルトではLLMは無効です（CONCIERGE_USE_LLM=0）。
有効化する場合のみ、以下を設定してください。

```bash
CONCIERGE_USE_LLM=1
OPENAI_API_KEY=...
# 任意
LLM_MODEL=...
LLM_MAX_TOKENS=...
LLM_BASE_URL=...
``` 
### よくある問題

**問題**: 401エラーが頻発する
- **原因**: トークンの期限切れ
- **解決**: BFFの自動リフレッシュロジックを確認

**問題**: CORSエラー
- **原因**: バックエンド直接呼び出し
- **解決**: 必ず`/api`経由にする

**問題**: Cookie が送信されない
- **原因**: `withCredentials: true`が設定されていない
- **解決**: axios設定を確認

---

## まとめ

このアプリは以下の特徴を持ちます：

1. **セキュア**: トークンをブラウザに露出しないBFFパターン
2. **シンプル**: 神社中心の情報設計
3. **拡張性**: 明確な責務分離による保守性の高さ

開発時は上記ルールを守り、不明点があればドキュメントを参照してください。
