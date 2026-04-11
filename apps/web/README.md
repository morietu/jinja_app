## ✅ `apps/web/README.md`（Web専用）完全版
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
> “存在するが未使用” のページは書かない（READMEが嘘になるから）

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

---

## 認証状態と認証導線

### 認証状態の source of truth
- 認証状態は `AuthProvider` を正本として扱う
- `/api/users/me/` は認証復元と認証状態確認のために使う
- 画面ごとに個別の `me` 取得を増やさない

### 状態の分離
- `AuthState`
  - ログイン状態そのもの
- `ProfileState`
  - 保存済みプロフィール情報（`nickname`, `birthday`）
- `ConciergeSessionState`
  - コンシェルジュ利用中だけ使う一時入力（`sessionNickname`, `temporaryBirthdate`）

保存済みプロフィールとコンシェルジュ内一時入力は混在させない。

### 表示名の優先順位
表示名は以下の順で解決する。

1. `sessionNickname`
2. `profile.nickname`
3. 未設定時は「あなた」

## 認証導線
- 相談・閲覧は未ログインでも利用可能
- 保存系操作とマイページはログイン必須
- 未ログイン時は login/register に遷移し、完了後は `returnTo` で元画面へ復帰する
- 例:
  - `/auth/login?returnTo=/concierge`
  - `/auth/register?returnTo=/concierge`
  - `/auth/login?returnTo=/mypage?tab=goshuin`

### 画面ごとの扱い
- `/concierge`
  - 未ログインでも利用可能
  - 保存系アクションのみログイン必須
- `/mypage`
  - ログイン必須
- お気に入り保存 / 相談保存 / プロフィール保存
  - ログイン必須

## 神社登録導線（Web実装ルール）

- 神社登録は `shrine` 本体APIへの直接追加ではなく、`submission API` を使う
- Web は shrine 本体を直接作成・更新する前提を持たない
- 登録入口は以下のいずれかに統一する
  - `/shrines/new`
  - `/mypage/shrine-submissions/new`
- 投稿はログインユーザーのみを前提とし、未ログイン時は login/register に遷移する
- 投稿完了時点では即公開扱いにせず、`pending` 前提でUIを構成する

## Billing / Premium UI ルール（Web実装ルール）

- premium UI 分岐は `/api/billings/status/` のレスポンスを基準に行う
- フロントは課金状態の正本を持たず、表示と再取得だけを責務とする
- UI分岐の判断は `plan` と `is_active` を基準にし、provider の値を分岐根拠にしない
- checkout / portal からの復帰後は billing status を refetch する
- checkout 完了直後の一時状態だけで premium 表示を確定しない

## Places / place_id の扱い（統一方針）
- `place_id` は常に `/places/resolve/` で `shrine_id` に解決して正規化する
- from-place 導線は廃止（今後復活させない）

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
- 認証 / プロキシ（最重要）: `docs/10_arch_auth_proxy.md`
- ローカル疎通: `docs/20_smoke_checks.md`
- API 概要: `docs/30_api_overview.md`

---

## Server fetch policy（BFF）

Route Handlers（`src/app/api/**/route.ts`）から Django(API) へアクセスする場合は、例外なく以下のどちらかを使う。

### Use `bffFetchWithAuthFromReq` when...
- 認証が絡む（Authorization / HttpOnly cookie forward が必要）
- refresh を含む（401/403 の再試行、access 更新が必要）

### Use `djFetch` when...
- 単純に Django へ中継するだけ（素通しプロキシ）
- JSON 以外（画像/バイナリ/任意 content-type）も壊さずに転送したい

### Forbidden
- server コード（`src/lib/server/**`, `src/app/api/**`）で `NEXT_PUBLIC_*` を参照すること
- route.ts 内で base URL を直に組むこと（API_BASE, DJANGO_BASE 等を自前で持たない）
