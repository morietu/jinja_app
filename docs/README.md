# docs/（設計・運用ドキュメント）

このディレクトリは **AI参拝ナビの設計・運用・実装判断の根拠**を集約します。  
「どこに何が書いてあるか」を最短で辿れることを目的にしています。

---

## 🧭 全体設計（まずここ）

- **アーキテクチャ / 認証 / プロキシ（最重要）**  
  - `10_arch_auth_proxy.md`

- **API 全体概要**  
  - `30_api_overview.md`

---

## 🔐 認証・通信

- **ローカル疎通確認（curl / fetch）**  
  - `20_smoke_checks.md`

> Web は必ず `/api`（Next Route Handler = BFF）経由で API を叩く。  
> Backend 直叩き（例：`http://127.0.0.1:8000/...`）をフロントコードに書かない。

---

## 🤖 AI / LLM

- 実装は `backend/temples/llm/` 配下  
- 方針：自由会話はしない。1回解析して構造化し、推薦・距離計算・フォールバックはサーバ側で決める。

（必要になったら追加予定）
- `llm/overview.md`（予定）

---

## 🧪 開発・検証

（必要になったら追加予定）
- `ci/testing_policy.md`（予定）

---

## 🚀 インフラ / デプロイ

- Render / Vercel 構成  
  - `40_infra_deploy.md`

（必要になったら追加予定）
- `infra/env_policy.md`（予定）

---

## 🎨 UI / UX メモ

- Concierge（SP幅）UI 違和感メモ  
  - `ui/concierge_sp_notes.md`

---

## 🗺 ロードマップ / TODO

- 開発 TODO / 優先度  
  - `90_roadmap.md`
