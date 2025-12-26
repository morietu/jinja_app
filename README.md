# AI参拝ナビ（MVP）

ユーザーの **現在地・ご利益・移動手段** から、  
参拝ルートとおすすめ神社を提案する **AIコンシェルジュアプリ** です。

Web を中心に開発し、将来的に Mobile（Expo）へ展開予定です。

---

本アプリでは、AIを用いてユーザーの相談文から
「ご利益・意図」を構造化し、最適な神社を3件提案します。

### AIの役割
- 自由会話は行いません
- 相談文を1回解析し、意図（ご利益など）をJSONとして抽出します
- 神社の選定・距離計算・フォールバックはサーバー側で行います

### 御朱印機能
- 御朱印画像の保存
- 公開 / 非公開の切り替え
- 個人利用を主目的としています


## 主な機能（MVP）

- 参拝ルート提案（徒歩 / 車）
- 周辺神社の推薦（人気・距離）
- AIコンシェルジュ（失敗時は距離順 top3 フォールバック）
- お気に入り / 御朱印（補助機能）

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
- Expo（WIP）

### AI
- OpenAI Responses API（Structured Outputs）

---

## Quick Start（ローカル）

### Backend

```bash
cd backend
source ../.venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 127.0.0.1:8000

PLACES_API_NEW=1 python manage.py runserver 8000

### Web
cd apps/web
pnpm install
pnpm dev

* Web: http://localhost:3000
* API: http://127.0.0.1:8000

### 重要ルール（承認/通信）
	•	Web は 必ず /api（Next プロキシ）経由で API を叩く
（バックエンド直 URL 禁止）
	•	axios 設定は以下を前提とする
	•	baseURL: "/api"
	•	withCredentials: true
	•	DRF は trailing slash 必須
例：/users/me/
	•	Authorization ヘッダは 手動で付けない
→ Next プロキシが Cookie から自動付与


### ドキュメント
詳細設計・運用ルールはすべて docs/ 配下に集約しています。
	•	アーキテクチャ / 認証
	•	docs/10_arch_auth_proxy.md
	•	ローカル動作確認（curl / fetch）
	•	docs/20_smoke_checks.md
	•	API 概要
	•	docs/30_api_overview.md
	•	インフラ / デプロイ
	•	docs/40_infra_deploy.md
	•	TODO / ロードマップ
	•	docs/90_roadmap.md
	•	UI メモ（Concierge / SP）
	•	docs/ui/concierge_sp_notes.md


### リポジトリ構成
jinja_app/
├── backend/        # Django + DRF
├── apps/
│   ├── web/        # Next.js
│   └── mobile/     # Expo（WIP）
└── docs/           # 設計・運用ドキュメント


### mobaile app(wip)
apps/mobile/ は 未着手 / プロトタイプ段階です。
	•	現時点では Git 管理対象外
	•	本格着手時に README を更新予定


### CI/Branch 運用
	•	main / develop は保護ブランチ
	•	PR 経由でのみマージ
	•	CI（backend / web）がすべて green であることを前提

詳細は docs/40_infra_deploy.md を参照してください。
