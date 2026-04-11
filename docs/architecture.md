## 🧩 ConciergeChatView 構成

### モジュール位置

`backend/temples/api/views/concierge.py`

### 役割

- LLM（OpenAI API）を通じて参拝プランを生成するエントリポイント
- 現段階では echo レスポンスでスモーク確認（MVP）
- 将来的には `chat_to_plan()` の呼び出しを有効化し、Shrine DB／経路APIと連携

### 設定との関係

| 設定項目 | 内容 |
| --- | --- |
| `REST_FRAMEWORK["DEFAULT_THROTTLE_CLASSES"]` | `ScopedRateThrottle` |
| `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["concierge"]` | `8/min` |
| View 内 `throttle_scope` | `concierge` |
| `permission_classes` | `AllowAny` |
| `authentication_classes` | `[]`（CSRF回避） |

### 呼び出しフロー

```
Front（Next） → POST /api/concierge/chat/
        ↓
ConciergeChatView.post()
        ↓
入力検証（message|query, lat, lng）
        ↓
chat_to_plan() もしくは Echo レスポンス
        ↓
HTTP 200 / 400 / 429
```

### 今後の拡張予定

- `chat_to_plan()` の本接続（LLM応答 → Shrine モデル特定 → ルート生成）
- ConciergeHistory 永続化と MyPage 連携
- `/api/concierge/recommendations` との設計統合

---

## 🔐 認証状態・プロフィール状態・利用状態の責務境界

本アプリでは、**認証そのもの**・**保存済みプロフィール**・**コンシェルジュ内一時入力**を分離して扱う。

### 1. AuthState

認証状態を表す層。AuthProvider が管理し、画面へ配布する。

```tsx
type AuthStatus = "unknown" | "authenticated" | "guest";

type AuthUser = {
  id: number;
  email?: string | null;
  username?: string | null;
  nickname?: string | null;
  birthday?: string | null;
};

type AuthState = {
  status: AuthStatus;
  user: AuthUser | null;
  isHydrating: boolean;
};
```

**責務**

- ログイン復元
- 認証状態確認
- user の配布
- login / logout / refreshMe の提供

`/api/users/me/` はこの層のために利用し、画面個別の責務に持ち込まない。

### 2. ProfileState

ログイン済みユーザーに保存されたプロフィール情報。

```tsx
type ProfileState = {
  nickname: string | null;
  birthday: string | null;
};
```

**責務**

- 永続プロフィール値の表現
- session 一時入力との分離

### 3. ConciergeSessionState

コンシェルジュ利用中だけ使う一時入力情報。未ログインでも保持できる。

```tsx
type ConciergeSessionState = {
  sessionNickname: string | null;
  temporaryBirthdate: string | null;
};
```

**責務**

- 相談中の呼び名
- 相性モード用の一時的な生年月日
- プロフィール保存とは別管理

---

## 表示名解決

表示名は `resolveDisplayName()` に統一し、以下の優先順位で決定する。

1. `sessionNickname`
2. `profile.nickname`
3. 未設定時は「あなた」

---

## 認証導線

**正規ルート**

- `/auth/login?returnTo=...`
- `/auth/register?returnTo=...`

**互換ルート**

- `/login`
- `/signup`

互換ルートは残すが、内部では正規ルートへリダイレクトする。

---

## アクション単位の認証ガード

ログイン必須判定は `isAuthRequiredForAction()` に集約する。

例:

- `save_concierge_thread` → required
- `save_profile` → required
- `toggle_favorite` → required
- `concierge_consult` → not required

判定関数は「必要判定」のみを責務とし、遷移処理は UI 側で扱う。

---

## 画面要件

### `/concierge`

- guest 利用可能
- ConciergeSessionState を使用
- 保存系のみログイン要求

### `/mypage`

- ログイン必須
- AuthProvider の状態を見て描画分岐する

### `/auth/login` / `/auth/register`

- 未ログイン前提の画面
- 不要な `me` 取得を避ける

---

# 🏛 Shrine Submission Pipeline

神社登録は `shrine` 本体への直接追加ではなく、**`submission` リソースを経由する投稿フロー**として扱う。

目的:

- 神社データ品質の保護
- 投稿責任の追跡
- 承認フローの維持

---

## 投稿主体

投稿は **ログインユーザーのみ** とする。

理由:

- 投稿責任の所在を持てる
- 重複投稿の追跡が可能
- 荒らし対策

anonymous 投稿は採用しない。

---

## Submission 状態

投稿データは `shrine_submission` として保存され、以下の状態を持つ。

- pending
- approved
- rejected

### pending

- 投稿直後の状態
- 公開されない
- 管理レビュー待ち

### approved

- 管理承認済み
- shrine 本体へ反映

### rejected

- 不正・重複・不完全投稿

---

## データモデル（予定）

```sql
shrine_submissions
-------------------
id
user_id
name
address
lat
lng
goriyaku_tags
note
status
created_at
reviewed_at
reviewed_by
-------------------
```

---

## Shrine 反映フロー

```
User
 ↓
POST /api/shrine-submissions
 ↓
shrine_submission (pending)
 ↓
admin review
 ↓
approved
 ↓
shrine table insert
```

---

## Duplicate Detection

投稿時に既存神社との重複をチェックする。

基本キー:

- name + address

一致する shrine が存在する場合:

- submission を reject
- または既存 shrine への関連付けを提示する

---

## MVP スコープ外

以下は今回の投稿機能には含めない。

- 画像アップロード
- 御朱印登録の同時実装
- 出典必須化
- 即公開

投稿データは最小構成のみ扱う。
