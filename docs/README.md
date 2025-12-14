# ドキュメント一覧（AI参拝ナビ）

このディレクトリは **AI参拝ナビの設計・運用・実装判断の根拠**を集約したドキュメント群です。  
ルート README.md からリンクされ、詳細はすべてここに集約されます。

---

## 🧭 全体設計

- **アーキテクチャ / 認証 / プロキシ**
  - `10_arch_auth_proxy.md`
- **API 全体概要**
  - `30_api_overview.md`

---

## 🔐 認証・通信

- Cookie / JWT / Next プロキシ設計
  - `10_arch_auth_proxy.md`
- ローカル疎通確認（curl / fetch）
  - `20_smoke_checks.md`

---

## 🤖 AI / LLM

- LLM 構成・設定・運用方針
  - `llm/overview.md`（予定）
- OpenAI 利用時の安全装置
  - レート制限 / キャッシュ / フォールバック

※ 実装は `backend/temples/llm/` 配下

---

## 🧪 開発・検証

- ローカル起動・確認手順
  - `20_smoke_checks.md`
- テスト / CI 方針
  - `ci/testing_policy.md`（予定）

---

## 🚀 インフラ / デプロイ

- Render / Vercel 構成
  - `40_infra_deploy.md`
- 環境変数 / Secrets 管理
  - `infra/env_policy.md`（予定）

---

## 🎨 UI / UX メモ

- Concierge（SP幅）UI 違和感メモ
  - `ui/concierge_sp_notes.md`

---

## 🗺 ロードマップ / TODO

- 開発 TODO / 優先度
  - `90_roadmap.md`

---


