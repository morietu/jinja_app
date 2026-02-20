# Concierge 仕様（設計・契約・運用）

本ドキュメントは、Concierge機能の

- LLMモード定義
- API契約（contract）
- 運用ログの読み方

を単一情報源として固定するための仕様書である。

---

# 1. LLMモード定義

## 1.1 モード区分

### LLM Enabled

- `CONCIERGE_USE_LLM = true`
- 外部LLM（OpenAI）呼び出しを許可
- Orchestrator経由で suggest 実行

### LLM Disabled

- `CONCIERGE_USE_LLM = false`
- 外部LLMは呼ばない
- Orchestratorは呼ばれる可能性あり（ルールベース/ダミー）

## 1.2 _signals.llm の意味

```json
"_signals": {
  "llm": {
    "enabled": bool,
    "used": bool,
    "error": string | null
  }
}
```

- `enabled`: 設定上LLMが許可されているか
- `used`: 実装上は enabled を反映（※現状、外部到達保証ではない）
- `error`: suggest失敗時の例外情報

---

# 2. API Contract（破壊禁止項目）
* この契約は docs/openapi.yaml によって強制される。

## 2.1 data._need

```json
{
  "tags": string[],
  "hits": { [tag]: string[] }
}
```

## 2.2 recommendations[].breakdown

```json
{
  "score_element": int,
  "score_need": int,
  "score_popular": float,
  "score_total": float,
  "weights": {
    "element": float,
    "need": float,
    "popular": float
  },
  "matched_need_tags": string[]
}
```

## 2.3 _signals.mode

```json
{
  "flow": "A" | "B",
  "weights": {...},
  "astro_bonus_enabled": bool
}
```

---

# 3. ログと運用

## 3.1 score_debug

- astro_priority
- _score_total
- distance_m
- has_breakdown

## 3.2 fallback_mode

| 値 | 意味 |
| --- | --- |
| none | 通常 |
| nearby_unfiltered | 条件一致0件のため距離優先表示 |

## 3.3 distance_mode 発火条件

- `sort_override = "sort_distance"`
- `fallback_mode == nearby_unfiltered`

---

# 4. 将来の改善点（未確定）

- llm_used の意味整理
- flow B のUX再設計
- extra_condition のスコア寄与最適化
