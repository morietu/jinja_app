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
- `enabled=false` でも `used=true` になり得る（suggest() の試行有無を示すため）。外部LLM到達とは無関係。
- `used`: suggest() を試行したか（外部LLM到達を保証しない）
- `error`: suggest失敗時の例外情報


## 1.3 LLM Disabled の禁止事項（厳守）

LLM Disabled のとき、以下は禁止する：

- 外部LLM（OpenAI等）への HTTP/SDK 経由の通信
- 外部推論API（LLMに準ずる第三者API）への通信（プロキシ経由も含む）
- 「キー未設定だから叩けない」など、結果論での非通信に依存する運用
- 推論目的の外部API呼び出しは原則禁止（分類器/要約API等、LLM相当のものを含む）

> Disabled は「叩けない」ではなく「叩かない」。

## 1.4 Orchestrator の位置づけ

- Orchestrator を呼ぶこと自体は、LLMの外部通信を意味しない
- LLM Disabled のとき、Orchestrator は「ルールベース／ローカル完結」の実装であることが期待される
- Orchestrator 内で外部LLM呼び出しが必要な場合は、LLM Enabled のときのみ許可する
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
