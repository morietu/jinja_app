# Concierge 設計索引

Concierge ドメインの責務分離・契約・外部依存方針の索引。

本ディレクトリは「入力正規化」「契約固定」「外部依存隔離」を中心に構成される。

---

## 1. 入力正規化（Normalization）

- docs/concierge/normalization.md

役割：
- 入力揺れ吸収の責務を serializer に固定
- 派生値生成と外部依存を service に分離
- PLAN_MAX_PLACE_LOOKUPS の課金防衛契約を明文化

---

## 2. API契約

関連テスト：

- backend/temples/tests/api/test_concierge_plan_api.py
- backend/temples/tests/test_concierge_api.py
- backend/temples/tests/test_concierge_flow_b_contract.py
- backend/temples/tests/test_concierge_need_contract.py

目的：
- 入出力形式を固定
- エラーフォーマットを固定
- 混入禁止（契約外フィールド）を担保

---

## 3. serializer 契約

- backend/temples/tests/serializers/test_concierge_serializers.py

固定事項：
- area/where/location_text → area_resolved
- lon → lng
- radius_km → radius_m
- radius_m clip (1..50000)
- location 必須エラー形式

---

## 4. plan 構造契約（AST）

- backend/temples/tests/test_concierge_plan_ast_contract.py

目的：
- plan は location 系を validated_data からのみ取得する
- request_data から直接参照しない

設計の破壊を構文レベルで防止する。

---

## 5. Places 課金防衛契約

- backend/temples/tests/services/test_concierge_plan_places_budget.py

固定事項：
- PLAN_MAX_PLACE_LOOKUPS を超えない
- 1件座標取得後は追加 lookup を行わない
- 0 の場合は呼び出さない

外部依存の暴走を防ぐ。

---

# 設計原則

- serializer は「公開契約と入力安定化」
- service は「派生値生成と外部依存処理」
- 外部API仕様は service に閉じ込める
- 契約はテストで固定する

---

# Done 状態

Concierge の「入力揺れ吸収」は完了している。

完了条件：

- serializer 契約テストが存在
- plan が validated_data 以外から location 系を参照しない（AST固定）
- API契約テストが通る
- PLAN_MAX_PLACE_LOOKUPS がテストで固定されている

これらが崩れない限り、入力層の設計は安定している。
