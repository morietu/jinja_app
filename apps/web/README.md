# apps/web（Next.js フロントエンド）

- Web: http://localhost:3000  
- API: Web からは `/api/...` でアクセス（直叩き禁止）

---

## 重要ルール（通信 / 認証）

### ✅ BFF（Next Route Handler）経由が前提
- Web → `/api/*` を叩く
- Backend 直URLをコードに書かない

### ✅ axios 前提
- `baseURL: "/api"`
- `withCredentials: true`

### ✅ DRF trailing slash 必須
- 例：`/users/me/`

### ✅ Authorization ヘッダは手動で付けない
- Cookie を BFF が引き回す設計  
- 詳細：`docs/10_arch_auth_proxy.md`

---

## 主要ルート（現状 “使っているものだけ”）

- `/`  
  - ホーム（検索 / コンシェルジュ入口など）

- `/concierge`  
  - AIコンシェルジュ UI

- `/shrines/[id]`  
  - 神社詳細（`shrine_id` 前提）

- `/shrines/resolve?place_id=...`  
  - `place_id` を `shrine_id` に解決して `/shrines/[id]` にリダイレクトする入口  
  - 内部的に `/api/places/resolve/` を利用

- `/shrines/hub/[id]`（互換・ハブ）  
  - `id` が数値なら `shrine_id` として `/shrines/[id]`  
  - 数値でなければ `place_id` とみなして `/shrines/resolve` に寄せる

- `/mypage`  
  - マイページ（御朱印 / お気に入りなど）

- `/auth/login`, `/auth/register`  
  - 認証系

> ※ “存在するが未使用” のページは書かない（READMEが嘘になるから）

---

## Places / place_id の扱い（統一方針）

- `place_id` は常に `/places/resolve/` で `shrine_id` に解決して正規化する
- `from-place` 導線は廃止（今後復活させない）

---

## ディレクトリ案内

- `src/app/api/**`  
  - Next Route Handlers（BFF）  
  - Cookie 引き回し / Backend 呼び出しの境界

- `src/lib/api/**`  
  - フロントから使う API クライアント（`/api` 前提）

- `src/features/**`, `src/components/**`  
  - UI / 機能コンポーネント群

---

## 関連ドキュメント

- 認証 / プロキシ（最重要）  
  - `docs/10_arch_auth_proxy.md`

- ローカル疎通  
  - `docs/20_smoke_checks.md`

- API 概要  
  - `docs/30_api_overview.md`
