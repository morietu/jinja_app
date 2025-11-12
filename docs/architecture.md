## 🧩 ConciergeChatView 構成

### モジュール位置

`backend/temples/api/views/concierge.py`

### 役割

- LLM（OpenAI API）を通じて参拝プランを生成するエントリポイント。
- 現段階では echo レスポンスでスモーク確認（MVP）。
- 将来的には `chat_to_plan()` の呼び出しを有効化し、Shrine DB／経路APIと連携。

### 設定との関係

| 設定項目                                                | 内容                 |
| ------------------------------------------------------- | -------------------- |
| `REST_FRAMEWORK["DEFAULT_THROTTLE_CLASSES"]`            | `ScopedRateThrottle` |
| `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["concierge"]` | `8/min`              |
| View 内 `throttle_scope`                                | `concierge`          |
| `permission_classes`                                    | `AllowAny`           |
| `authentication_classes`                                | `[]`（CSRF回避）     |

---

### 呼び出しフロー

```text
Front（Next） → POST /api/concierge/chat/
        ↓
ConciergeChatView.post()
        ↓
入力検証（message|query, lat, lng）
        ↓
chat_to_plan() もしくは Echo レスポンス
        ↓
HTTP 200 / 400 / 429
今後の拡張予定
 • chat_to_plan() の本接続（LLM応答→Shrine モデル特定→ルート生成）
 • ConciergeHistory 永続化と MyPage 連携
 • /api/concierge/recommendations との設計統合
```
