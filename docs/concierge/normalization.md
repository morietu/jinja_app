# Concierge: 入力正規化と派生値生成の責務（Normalization）

## 目的

- 入力揺れをどこで吸収するかを明確にする
- serializer と service の責務を分離する
- 外部依存（Google Places 等）を API 契約から隔離する
- 将来の仕様変更・外部API変更に対する耐性を持たせる

---

# 基本原則

値の所属は、以下の4観点で判断する。

1. API契約として公開したい概念か？
2. ドメイン語彙で説明できる意味を持つか？
3. 外部API仕様に強く依存しているか？
4. 入力揺れ吸収のために必要か？

## 判断ルール

| 条件 | 置き場所 |
|------|----------|
| 公開契約 / ドメイン語彙 / 入力揺れ吸収 | serializer（validated_data） |
| 外部依存 / 実装語彙 / 最適化パラメータ | service |

---

# serializer の責務（validated_data を真実とする）

serializer は「API契約の門番」であり、
入力の揺れを吸収して正規化された値を提供する。

## 正規化対象（固定契約）

### 1. location text alias 吸収

入力:
- area
- where
- location_text

正規化:
- area_resolved（str or None）

---

### 2. 座標 alias 吸収

入力:
- lat
- lng
- lon

正規化:
- lng ← lon を吸収
- lat/lng は Float に確定

---

### 3. 半径 alias 吸収

入力:
- radius_m
- radius_km

正規化:
- radius_m に統一
- 既定値 8000
- 1..50000 に clip

plan 側は radius_m のみ参照する。

---

### 4. location 必須条件

area_resolved が無い場合は、
lat/lng が両方必要。

バリデーションエラー形式は DRF 標準:

{
  "location": ["area または lat/lng が必要です。"]
}

---

# service（plan/chat）の責務

service は「派生値生成」と「外部依存処理」を担う。

## 派生値の例

- locationbias
- geocode 実行
- Google Places API 呼び出し
- 外部I/O回数の制御
- キャッシュ適用

---

# locationbias の扱い

locationbias は Google Places の検索バイアス文字列であり、
ドメイン語彙ではなく実装語彙である。

## 原則

- serializer は locationbias を生成しない
- serializer は locationbias を正規化しない
- plan 側で bias から生成する

例:
locbias = serializer_validated.get(“locationbias”)
if not locbias and bias:
locbias = bf._lb_from_bias(bias)

---

# plan 内の入力参照ルール

location 系の値は必ず serializer_validated から取得する。

参照元:

- area_resolved
- lat
- lng
- radius_m
- locationbias（入力がある場合のみ）

request_data から location 系を直接参照してはならない。

---

# 外部依存の隔離

以下は service 層の責務とする:

- requests.get(...) による geocode
- GP.findplacefromtext(...)
- Google Places 形式文字列生成
- 予算制御（PLAN_MAX_PLACE_LOOKUPS 等）

serializer 層は外部I/Oを行わない。

---

# テスト固定事項

入力正規化は serializer テストで固定する。

対象テスト:

- backend/temples/tests/serializers/test_concierge_serializers.py

確認事項:

- lon → lng 吸収
- where/location_text → area_resolved
- radius_km → radius_m
- radius_m clip
- location 必須エラー形式

plan API テストでは、
入力 alias が正しく動作することを確認する。

---

# 変更時のルール

- 入力 alias を追加する場合は serializer に追加する
- 外部API依存ロジックは service にのみ追加する
- serializer が外部I/Oを持たないことを守る
- location 系を request_data から直接参照しない
- 正規化契約を変更する場合はテストを同時更新する

---

# 設計意図

serializer は「公開契約と入力安定化」の責務を持つ。

service は「派生値生成と外部依存」の責務を持つ。

この分離により:

- 外部API変更に対する耐性を確保
- API契約の安定化
- 実装変更時の影響範囲限定
- テスト容易性向上

を実現する。

plan の location 系入力（area/lat/lng/radius）は ConciergePlanRequestSerializer で正規化し、plan 側は validated_data のみを入力ソースとする（request_data から location 系を直接参照しない）。一方 locationbias は Google Places の最適化パラメータでありドメイン概念ではないため、serializer では生成せず、入力が無い場合は plan service 側で bias から派生生成する。これにより「入力揺れ吸収」と「外部依存（Google仕様）変更耐性」を分離し、API契約の安定性を上げる。


## Done 条件（入力揺れ吸収）

以下が満たされたら「入力揺れ吸収」は完了とする。

- [ ] serializer 契約テストが存在し、alias/clip/必須エラー形式が固定されている  
      (`backend/temples/tests/serializers/test_concierge_serializers.py`)
- [ ] plan service は location 系（area/lat/lng/radius）を `validated_data` からのみ参照し、`request_data` から直接参照しない
- [ ] plan/chat の API 契約テストが通る（混入禁止・エラーフォーマット含む）  
      (`backend/temples/tests/api/test_concierge_plan_api.py`, `backend/temples/tests/test_concierge_api.py`)
- [ ] locationbias は serializer が生成せず、必要時のみ service が派生生成する（外部依存の隔離）
