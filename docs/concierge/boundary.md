# Concierge: chat / plan 責務境界（Boundary）

目的:
- chat と plan の責務を分離し、API契約の混線を防ぐ
- フロントの例外処理・分岐沼を未然に防ぐ
- 将来の拡張（LLM強化 / ルート最適化 / キャッシュ等）を安全にする
- 外部I/O回数などの観測メトリクスを安定させる

---

## 用語
- chat: /api/concierge/chat/
- plan: /api/concierge/plan/
- “推薦”: 候補の選定 + 理由生成（場合によってLLM）
- “計画”: 場所検索 + 経路ヒント生成（場所/ルートの確定要素）

---

# chat の責務

chat は「推薦生成」に責務を持つ。

## chat が行うこと（MUST）
- ユーザー入力（message/query）を受け取る
- 推薦（recommendations）を生成する
- intent を返す（LLM無効時はヒューリスティックでも良い）
- 必要に応じて reply を返す（UI向けの文言）
- 任意で thread を返す（認証ユーザーのみ）

## chat が行ってよいこと（MAY）
- candidates の補完（area/lat/lng/bias をもとに候補を増やす）
- location（短縮ラベル）等の表示補助の付与
- 住所の正規化・短縮表示

## chat が行ってはいけないこと（MUST NOT）
- plan の出力形式（main / alternatives / route_hints）を返してはならない
- 経路計算・ルート最適化を担ってはならない（plan 側の責務）
- 検索結果の確定構造を返してはならない

---

# plan の責務

plan は「検索 + 経路ヒント」に責務を持つ。

## plan が行うこと（MUST）
- query と location（area or lat/lng）を受け取る
- main（中心候補）と alternatives を返す
- route_hints（移動モード等）を返す
- バリデーションエラーは DRF標準の field->list[str] 形式で返す

## plan が行ってよいこと（MAY）
- geocode（area -> lat/lng）
- Places への問い合わせ（find_place / nearby_search）
- キャッシュを活用して外部リクエスト数を抑える

## plan が行ってはいけないこと（MUST NOT）
- 推薦理由の生成（reason の生成）を担ってはならない（chat 側の責務）
- intent / reply / thread / recommendations を返してはならない

---

# レスポンス形の非混入契約

## chat は以下を返してはならない
- main
- alternatives
- route_hints

トップレベルにも data 配下にも含めてはならない。

契約テスト:
- backend/temples/tests/test_concierge_api.py

## plan は以下を返してはならない
- recommendations
- intent
- reply
- thread

契約テスト:
- backend/temples/tests/api/test_concierge_plan_api.py

---

# エラーレスポンス契約（400）

原則:
- {"field": ["message", ...]} 形式（DRF標準）に統一する
- {"detail": "..."} への寄せはしない（serializer バリデーションと噛み合わないため）

## plan 例
- query missing/blank  
  -> {"query": ["この項目は必須です。"]}

- location missing  
  -> {"location": ["area または lat/lng が必要です。"]}

契約テスト:
- backend/temples/tests/api/test_concierge_plan_api.py

---

# places_sync: requests_used の契約

## 意味
`requests_used` は「外部I/O（Google Places 等）を叩いた回数の近似値」とする。

これは:
- キャッシュ導入の回帰検知
- 外部依存コストの観測
- バッチ運用の健全性確認

のための指標である。

## ルール
- `_google_places_nearby_search()` の返り値に `cached=True` が含まれる場合のみ `requests_used += 0`
- それ以外（`cached` 無し / False / 不正値含む）は `requests_used += 1`
- cached の型が bool でない場合も True でない限り 1 とみなす

## 重要な前提
- sync_nearby_seed は外部I/Oを直接叩かず、
  `_google_places_nearby_search()` を唯一の窓口とする
- requests_used の算出はこの窓口の戻り値のみに依存する

## 公開範囲（重要）
`requests_used` は内部メトリクスであり、chat / plan API レスポンスには含めない。
必要な観測はログ、管理画面、バッチ結果、メトリクス基盤等で行う。

契約テスト:
- backend/temples/tests/services/test_places_sync.py

---

# 変更時のルール

- chat / plan の契約に影響する変更は、必ず契約テストを更新すること
- requests_used の算出ロジックを変更する場合は、契約セクションとテストを同時に更新すること
- “便利だから混ぜる” は禁止（混線はフロント地獄を呼ぶ）
- 責務の追加は MAY で書き足し、MUST/MUST NOT は慎重に変更する
