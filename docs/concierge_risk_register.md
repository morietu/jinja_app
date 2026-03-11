# Concierge Risk Register

最終更新: 2026-03-11  
対象: `backend/temples/` の concierge 周辺

---

## 目的

concierge 系の実装で、今後の変更時に壊れやすい箇所を先回りして把握し、
「どこが危ないか」「何で守れているか」「次に何を足すべきか」を明確にする。

---

## 運用ルール

- `危険度` は High / Medium / Low の3段階
- `既存テスト` は主に契約・回帰防止に効いているものを書く
- `未防御` は今まだ抜けている観点を書く
- `次の一手` は、リファクタではなく **まず防御を増やす** 方針で書く
- 実装修正を入れたら、この台帳も同じPRで更新する

---

## リスク一覧

| ID | 箇所 | 危険度 | リスク概要 | 既存テスト | 未防御 | 次の一手 | 状態 |
|---|---|---|---|---|---|---|---|
| CR-001 | `backend/temples/api_views_concierge.py` | High | 責務過多。request正規化、filters互換、geocode、candidate構築、dedupe、auth、rate limit、flow判定、response整形まで1ファイルに集中 | `test_concierge_chat_smoke.py`, `test_concierge_chat_message_passthrough.py`, `test_concierge_chat_need_breakdown_contract.py`, `test_concierge_chat_dedupe.py` | 分岐順変更による契約崩れ。`message/query` 優先順位、`filters` 畳み込み、rate limit時の返答形式 | view責務を分割する前に、入力正規化とresponse契約のテストを追加 | Open |
| CR-002 | `build_chat_recommendations()` | High | 候補選定、need抽出、LLM fallback、pool補填、score計算、signals構築、message生成まで担っており、変更時の影響範囲が広い | `test_concierge_need_contract.py`, `test_concierge_llm_signals.py`, `test_concierge_eval_queries.py`, `test_concierge_chat_sort_distance.py` | top3切り出し前後での count 意味揺れ。explanations 後のフィールド上書き | `displayed_count/pool_count/matched_count` の定義をコメント化し、専用テストを足す | Open |
| CR-003 | `_attach_breakdown()` | High | API契約用スコアと内部ランキング用スコアが分離されており、意図を誤読されやすい | `test_concierge_chat_need_breakdown_contract.py`, `test_concierge_need_contract.py`, `test_concierge_need_variation.py` | `breakdown.score_total` と実際の並び順の差異に対する誤修正 | docstring / コメントで「契約用」「内部用」を明示し、rank用scoreの回帰テストを追加 | Open |
| CR-004 | response contract (`_signals`, `result_state`, `reply`, `reason_source`) | High | フロント依存の契約。少しの整理で壊れやすい | `test_concierge_chat_need_breakdown_contract.py`, `test_concierge_need_contract.py`, `test_concierge_signals_contract.py` | `reply` の mode差異、fallback時文言、prefix契約の逸脱 | 契約テストを維持しつつ、mode別matrixテストを追加 | Open |
| CR-005 | candidate dedupe (`_candidate_key`, `_dedupe_candidates`) | Medium-High | place_id / shrine_id / name+address の優先順が妥当でも、揺れデータで事故りやすい | `test_concierge_chat_dedupe.py`, `test_concierge_chat_candidates_dedupe.py` | `formatted_address` と `address` の差、place_idなし・idなしケース、同名異住所、異名同place_id | 例外ケースを fixture 化して増やす。dedupe方針をコメントで固定 | Open |
| CR-006 | `build_chat_candidates()` | Medium | DB候補抽出の入口。除外条件、order、欠損データの扱いで結果が変わりやすい | 直接のピンポイント防御は薄い。間接的に concierge 系テストがカバー | `exclude(latitude__isnull=True, longitude__isnull=True)` の意図誤読、noisy name 除外、popular_score依存 | 候補構築専用テストを追加し、欠損・除外・orderの期待値を固定 | Open |
| CR-007 | `need_tags` 抽出ロジック | Medium | クエリ文言のちょっとした変更で need が変わり、推薦結果が連鎖して変わる | `test_concierge_eval_queries.py`, `test_concierge_need_variation.py`, `test_concierge_need_contract.py` | 同義語追加時の副作用。career / money / mental / rest の境界 | need抽出の代表クエリを fixture 化して固定、変更時の影響を見える化 | Open |
| CR-008 | `representative_shrines.yaml` と fixture の整合 | Medium | seed と fixture がズレると、仕様変更か回帰か判定しにくい | `test_concierge_eval_queries.py` が間接検知 | seed更新時に fixture 未更新、fixture更新時に期待名が古い | seed/fixture同期ルールを文書化。変更時に checklist で確認 | Open |
| CR-009 | location backfill | Medium | recommendationに location がないと外部依存の補完が走り、テストや本番で揺れやすい | `test_backfill_and_concierge_fallbacks.py`, `test_concierge.py`, `test_concierge_api.py` | dedupe後やcandidate優先との相互作用。API依存の副作用 | 「候補に住所があるなら外部参照しない」系の契約を維持強化 | Open |
| CR-010 | flow A / B 判定 | Medium | `goriyaku_tag_ids`, `extra_condition` の有無だけで分岐しており、将来条件追加時に壊れやすい | `test_concierge_flow_b_contract.py`, `test_concierge_need_contract.py` | 空配列・空文字・filters経由の揺れ、UIとの期待ズレ | flow判定だけを切り出した小関数に寄せる前提で、先にテストを増やす | Open |
| CR-011 | rate limit と guest/auth/premium 分岐 | Medium | viewロジックと密結合。返答形式やカウント更新タイミングが崩れやすい | `test_concierge_rate_limit.py`, `test_concierge_recommend_limit_contract.py`, `test_concierge_drf_throttle.py` | dedupeやresponse整形変更時の副作用 | limit到達時の body 契約を追加で固定 | Open |
| CR-012 | eval query fixtures | Medium | 実質スナップショット。改善でも落ちるし、退化でもすり抜けることがある | `test_concierge_eval_queries.py` | expected_top_names の保守基準が曖昧 | 「完全一致ではなく候補集合一致」で守る方針を維持しつつ、caseメモを増やす | Open |

---

## 重点監視エリア

### 1. View層の分岐順
特に以下は変更時に事故りやすい。

- `message` と `query` の優先順位
- `filters` からトップレベルへの畳み込み
- `lat/lng` と `area` geocode の優先順位
- rate limit 到達時の返答形式
- `flow` 判定

### 2. スコア契約と内部ランキングの差
以下は必ずセットで理解する。

- `breakdown.score_total`: API契約用
- `rec["_score_total"]`: 内部ソート用
- `breakdown_detail.features.need.rank_raw`: 内部用補助情報

### 3. candidate の重複排除
以下の優先順位は変更時に要注意。

1. `place_id`
2. `shrine_id` / `id`
3. `name + address/formatted_address`

---

## 直近で追加済みの防御

- user candidate と built candidate の dedupe APIテスト
- dedupe helper の serviceテスト
- need / breakdown / result_state / reason_source の契約テスト
- representative candidate fixture を使った eval query テスト

---

## 次に追加すべきテスト候補

### 優先度A
1. `filters` 経由の `goriyaku_tag_ids` / `extra_condition` / `birthdate` が view で正しく吸い上がるテスト
2. rate limit 到達時でも `message` モードの `reply` 形式が崩れないテスト
3. `breakdown.score_total` と並び順が一致しないケースでも、意図どおり契約が維持されるテスト

### 優先度B
4. `build_chat_candidates()` の除外条件テスト
5. place_id なし / shrine_id なし / address 空の dedupe 境界テスト
6. seed / fixture の差分検知テストまたは更新チェック

### 優先度C
7. `api_views_concierge.py` の request 正規化部分を小関数化する前提の characterisation test
8. explanation 付与後に `reason` / `reason_source` 契約が崩れないテスト

---

## 将来の分割候補

### 候補1: request 正規化
`api_views_concierge.py` から切り出し候補

- filters畳み込み
- query/message 解決
- lat/lng + area 解決
- bias 生成

### 候補2: candidate pipeline
- user candidate 取得
- built candidate 取得
- merge
- dedupe

### 候補3: response builder
- `_signals`
- `reply`
- `_debug`
- thread 情報

### 候補4: score engine
`build_chat_recommendations()` から切り出し候補

- need 抽出
- score 計算
- sort
- response meta 生成

---

## 今の判断

- 今すぐ大規模リファクタはしない
- 先に「壊れる場所の契約」を増やす
- その後、`api_views_concierge.py` を薄くする
- `build_chat_recommendations()` は score engine と response assembly の境界を分ける方向で検討する

---

## 更新履歴

- 2026-03-11: 初版作成
