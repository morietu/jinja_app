# Concierge 仕様（設計・契約・運用）

本ドキュメントは、Concierge機能の

- 入力仕様
- LLMモード定義
- API契約（contract）
- 運用ログの読み方

を単一情報源として固定するための仕様書である。

---

# 0. Input Specification（入力仕様）

## 0.1 入力モデル

Concierge入力は以下の構造を持つ：

```json
{
  "query": "string | null",
  "message": "string | null",
  "birthdate": "string | null",
  "filters": {
    "birthdate": "string | null"
  }
}
```

- `birthdate` は構造化入力であり、free text とは分離する（MUST）
- `backend` が最終的な正規化責務を持つ（MUST）

## 0.2 birthdate 受理形式

以下の形式を受理する：

- `YYYY-MM-DD`
- `YYYY/MM/DD`
- `YYYYMMDD`

内部では必ず `YYYY-MM-DD` に正規化する（MUST）

無効値は破棄する（エラーにはしない）（MUST）

## 0.3 正規化責務

- クライアントは任意で正規化してよい（SHOULD）
- `backend` が必ず再正規化する（MUST）

## 0.4 free text rescue

以下の条件でのみ適用する：

- top-level `birthdate` が空
- `filters.birthdate` も空
- `query` または `message` が birthdate 形式のみ

**rescue 成功時：**

- `birthdate` に採用する
- `query` / `message` は空として扱う

**rescue 失敗時：**

- 通常の `need` 処理へフォールバックする
- エラーにはしない

## 0.5 mode 判定

`mode` は以下：

- `need`
- `compat`

**優先順位：**

1. 明示 `mode` があればそれを採用する
2. `birthdate` が存在し、かつ `query` / `message` が空なら `compat`
3. それ以外は `need`

## 0.6 flow 判定

`flow` は以下：

- `A`: 通常推薦
- `B`: フィルタ主導推薦

判定は `backend` が最終責務を持つ。

### 判定ルール

以下のいずれかを満たす場合、`flow` は `B` とする：

- `goriyaku_tag_ids` が空でない配列
- `extra_condition` が trim 後に空でない文字列

上記を満たさない場合、`flow` は `A` とする。

### 補足

- `message` は `query` より優先して処理される
- top-level の `birthdate` / `goriyaku_tag_ids` / `extra_condition` は `filters` より優先される
- 最終的な期待動作は実装とテストを source of truth とする

## 0.7 バリデーション方針

**専用入力（birthdate）**

- 不正形式はクライアントでエラー表示する（SHOULD）

**free text rescue**

- 不正入力は無視する（MUST）
- 全体をエラーにしない（MUST）

---

# 1. LLMモード定義

## 1.1 モード区分

**LLM Enabled**

- `CONCIERGE_USE_LLM = true`
- 外部LLM（OpenAI）呼び出しを許可
- Orchestrator 経由で `suggest` 実行

**LLM Disabled**

- `CONCIERGE_USE_LLM = false`
- 外部LLMは呼ばない
- Orchestrator は呼ばれる可能性あり（ルールベース / ダミー）

## 1.2 _signals.llm の意味（運用契約）

```json
"_signals": {
  "llm": {
    "enabled": "bool",
    "used": "bool",
    "error": "string | null"
  }
}
```

- `enabled`: 設定上LLMが許可されているか
- `used`: `suggest()` を試行したか（外部LLM到達を保証しない）
- `error`: `suggest` 失敗時の例外情報

## 1.3 LLM Disabled の禁止事項（厳守）

LLM Disabled（`CONCIERGE_USE_LLM = false`）のとき、以下は禁止する：

- 外部LLM（OpenAI等）への HTTP / SDK 経由の通信
- 外部推論API（LLMに準ずる第三者API）への通信（プロキシ経由も含む）
- 「キー未設定だから叩けない」など、結果論での非通信に依存する運用
- 推論目的の外部API呼び出しは原則禁止（分類器 / 要約API等、LLM相当のものを含む）

Disabled は「叩けない」ではなく「叩かない」。

## 1.4 Orchestrator の位置づけ（MUST）

- Orchestrator を呼ぶこと自体は許容される（内部の推薦ロジック入口として扱う）
- LLM Disabled のとき、Orchestrator は外部通信を行ってはならない（MUST NOT）
- つまり Disabled の Orchestrator は「ルールベース / ローカル完結」であることが必須
- Orchestrator 内で外部LLM呼び出しが必要な実装は、LLM Enabled のときのみ許可する

**フィールド説明**

- `enabled`: 外部LLM（OpenAI等）への通信を許可する設定（= `CONCIERGE_USE_LLM`）
- `used`: 当該リクエスト処理で、外部LLM通信を伴う処理（試行含む）を実行したか
    - LLM Disabled（`enabled=false`）の場合、`used=true` は禁止（仕様違反）
- `error`: LLM処理（または Orchestrator 内処理）で例外が発生した場合の情報
    - 例外が無い場合は `null`

**注意:** `used=true` は「成功して外部LLMに到達した」ことを保証しない（失敗やタイムアウトも含む）。ただし「外部LLMに到達し得る経路を実行した」ことは示す。

---

# 2. API Contract（破壊禁止項目）

この契約は `docs/openapi.yaml` によって強制される。

## 2.1 data._need

```json
{
  "tags": ["string"],
  "hits": {
    "tag": ["string"]
  }
}
```

## 2.2 recommendations[].breakdown

```json
{
  "score_element": "int",
  "score_need": "int",
  "score_popular": "float",
  "score_total": "float",
  "weights": {
    "element": "float",
    "need": "float",
    "popular": "float"
  },
  "matched_need_tags": ["string"]
}
```

## 2.3 _signals.mode

```json
{
  "flow": "A | B",
  "weights": {},
  "astro_bonus_enabled": "bool"
}
```

---

# 3. ログと運用

## 3.1 score_debug

- `astro_priority`
- `_score_total`
- `distance_m`
- `has_breakdown`

## 3.2 fallback_mode

| **値** | **意味** |
| --- | --- |
| `none` | 通常 |
| `nearby_unfiltered` | 条件一致 0 件のため距離優先表示 |

## 3.3 distance_mode 発火条件

- `sort_override = "sort_distance"`
- `fallback_mode == nearby_unfiltered`

---

# 4. 将来の改善点（未確定）

- `llm_used` の意味整理
- flow B の UX 再設計
- `extra_condition` のスコア寄与最適化

Agents modifying these areas must ensure tests cover the change.

**High-risk areas include:**

- `api_views_concierge.py`
- `build_chat_recommendations()`
- `_attach_breakdown()`
- candidate deduplication

---

# Coding Style

Follow the existing project conventions.

**General rules:**

- Python 3.11
- pytest
- small functions
- explicit naming
- minimal magic

Prefer clarity over cleverness.

---

# Commit Guidelines

Commits should be:

- small
- focused
- test-backed

**Example:**

> Add regression test for concierge candidate dedupe
> 

Avoid commits that mix:

- refactor + behavior change

---

# When in Doubt

If behavior is unclear:

1. Check tests
2. Check risk register
3. Add tests before modifying code

Never guess expected behavior.

---

# Final Rule

**Tests are the source of truth.**

If implementation and tests disagree, tests must be updated only when the change is intentional and documented.
