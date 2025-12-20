# Billing / Paywall 仕様（AI コンシェルジュ）

## 目的
- 課金状態（billing）と利用制限（paywall）の判定基準を**一意に定義**する
- UI / API / テストで参照する**唯一の仕様書**とする
- 「premium なのに止まる」「free なのに出ない」などの事故を防ぐ

---

## 用語定義

### Billing Status（/api/billings/status/）
| フィールド | 意味 |
|---|---|
| plan | `free` / `premium` |
| is_active | 課金が有効かどうか |
| provider | `stripe` / `stub` |
| current_period_end | 課金期限（free は null 可） |
| cancel_at_period_end | 期間終了で解約予定か |

### Paywall 情報（/api/concierge/chat/ レスポンス）
| フィールド | 意味 |
|---|---|
| remaining_free | 当日残り無料回数 |
| limit | 無料回数上限 |
| note | 課金を促すメッセージ（表示用） |

---

## 真実の所在（重要）

- **利用可否の最終判断はサーバー**
- フロントは以下を前提にする：
  - concierge/chat が返す `remaining_free / note` → **制限の事実**
  - billing/status → **premium かどうかの上書き条件**

---

## 判定ルール（最重要）

### 1. Premium 優先ルール
```text
billing.plan === "premium" AND billing.is_active === true
→ いかなる場合も paywall を出さない
→ canSend は常に true

### 2. Free 制限ルール
billing が premium(active) でない場合：

- remaining_free > 0
  → 送信可能
  → paywall 非表示

- remaining_free <= 0
  → 送信不可
  → paywall 表示（note を使う）

  ### 3. billing 未確定時（loading / error）
  billing が未取得 or エラーの間は：
- 誤ブロックを避ける
- canSend = true
- paywall 非表示

### UI 判定ロジック（フロント共通）

const isPremiumActive =
  !billing.loading &&
  !billing.error &&
  billing.status?.plan === "premium" &&
  billing.status?.is_active === true;

const hitPaywall =
  (typeof remainingFree === "number" && remainingFree <= 0) ||
  !!paywallNote;

// 表示
const showPaywallHint = hitPaywall && !isPremiumActive;

// 送信可否
const canSend =
  isPremiumActive ||
  !(typeof remainingFree === "number" && remainingFree <= 0);
このロジックを 各画面で再実装しないこと
共通 hook / util に寄せるのは将来タスク

⸻

concierge/chat API の責務
	•	回数制限の判定
	•	remaining_free, note の返却
	•	premium ユーザーでも値は返ってよい
→ フロント側で premium が上書きする

⸻

非対応（明示）
	•	無料残回数の常時表示
	•	billing だけで制限判断（concierge を通さない制御）
	•	premium trial / grace period の UI 分岐（別途定義）

⸻
テスト要件（最低限）
	•	free → limit 到達 → paywall 表示 + canSend=false
	•	premium(active) → limit 超過しても送信可能
	•	access token 期限切れ → refresh 後も判定が維持される

⸻
---
