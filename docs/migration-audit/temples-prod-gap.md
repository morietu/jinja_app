# 🧾 temples migration 本番差分

## ゴール
migration履歴と実テーブルの不整合を可視化する

---

## 現在の本番状態

### django_migrations
- 0001_initial
- 0002_goshuin_shrine
- 0003_backfill_missing_tables

### 実テーブル（抜粋）
- temples_conciergethread
- temples_conciergemessage
- temples_conciergeusage
- temples_shrine
- temples_visit
- temples_featureusage（手動作成）

---

## 差分表

| migration | 想定内容 | 本番テーブル | migration適用 | 状態 |
|----------|--------|------------|------------|------|
| 0001_initial | 基本テーブル | Yes | Yes | OK |
| 0002_goshuin_shrine | 追加 | Yes | Yes | OK |
| 0003_backfill_missing_tables | 補完 | Yes | Yes | OK |
| 0077_featureusage | FeatureUsage作成 | Yes（手動） | No | 不整合 |

---

## 分類

### 手動補完済み
- 0077_featureusage

### fake候補
- FeatureUsage（テーブル・index・constraintが既に存在）

### 要調査
- concierge系テーブルがどの migration に紐づくか

---

## リスク

- migrate実行で重複作成エラー
- rollback不可
- schema driftが拡大

---

## 方針（仮）

- FeatureUsageは `--fake` で履歴だけ合わせる
- それ以外は個別に安全確認


## 2026-03-22 実体監査結果

`django_migrations` 上は `temples` が 0077 まで適用済みだが、
本番DBで主要テーブル実在を確認したところ、以下のみ存在した。

- temples_conciergemessage
- temples_conciergethread
- temples_conciergeusage
- temples_featureusage
- temples_shrinecandidate

以下は存在しなかった。

- temples_conciergerecommendationlog
- temples_placecache
- temples_placesseed
- temples_placesseedstate
- temples_goshuin
- temples_goshuinimage
- temples_crawltile

### 判断
`temples` の migration 履歴は本番実体と不整合。
ただし以下は疎通確認済み。
- concierge chat
- FeatureUsage


## 2026-03-22 ローカル空DB再構築結果

ローカル `jinja_db` を空にして `python manage.py migrate` を実行し、
以下の `temples_%` テーブル生成を確認した。

- temples_concierge_recommendation_click_log
- temples_concierge_recommendation_log
- temples_conciergehistory
- temples_conciergemessage
- temples_conciergethread
- temples_conciergeusage
- temples_crawltile
- temples_deity
- temples_favorite
- temples_featureusage
- temples_goriyakutag
- temples_goshuin
- temples_goshuinimage
- temples_like
- temples_rankinglog
- temples_shrine
- temples_shrine_goriyaku_tags
- temples_shrinecandidate
- temples_visit

この一覧をローカル再現時の正解側とみなし、
本番実体との差分監査に用いる。

## 本番との差分表（2026-03-22）

| table_name | ローカル空DB | 本番 | 状態 | 対応方針 |
|---|---:|---:|---|---|
| temples_concierge_recommendation_click_log | Yes | No/未確認 | 差分候補 | 要確認 |
| temples_concierge_recommendation_log | Yes | Yes | OK | 維持 |
| temples_conciergehistory | Yes | No/未確認 | 差分候補 | 要確認 |
| temples_conciergemessage | Yes | Yes | OK | 維持 |
| temples_conciergethread | Yes | Yes | OK | 維持 |
| temples_conciergeusage | Yes | Yes | OK | 維持 |
| temples_crawltile | Yes | No/未確認 | 差分候補 | 要確認 |
| temples_deity | Yes | Yes | OK | 維持 |
| temples_favorite | Yes | No/未確認 | 差分候補 | 要確認 |
| temples_featureusage | Yes | Yes | 手動補完 + fake済み | 維持 |
| temples_goriyakutag | Yes | Yes | OK | 維持 |
| temples_goshuin | Yes | No/未確認 | 差分候補 | 要確認 |
| temples_goshuinimage | Yes | No/未確認 | 差分候補 | 要確認 |
| temples_like | Yes | No/未確認 | 差分候補 | 要確認 |
| temples_rankinglog | Yes | No/未確認 | 差分候補 | 要確認 |
| temples_shrine | Yes | Yes | OK | 維持 |
| temples_shrine_goriyaku_tags | Yes | Yes | OK | 維持 |
| temples_shrinecandidate | Yes | Yes | OK | 維持 |
| temples_visit | Yes | Yes | OK | 維持 |


## 差分テーブルの修復単位分類（A〜E）

本番とローカル空DB再構築結果の差分を、修復の安全性と依存関係に基づいて以下の単位に分類する。

### A. 基盤テーブル
最も土台に近いテーブル群。他機能の前提になりやすく、修復時は存在・列・制約の確認を優先する。

- temples_shrine
- temples_goriyakutag
- temples_deity
- temples_visit

### B. 神社関連の中間・補助テーブル
A の基盤テーブルに依存する補助テーブル。神社関連の機能差分を埋める単位として扱う。

- temples_shrine_goriyaku_tags
- temples_shrinecandidate

### C. concierge系テーブル
今回の主障害に最も近い機能単位。稼働中APIに影響するため、最優先で監査・整合回復対象とする。

- temples_conciergemessage
- temples_conciergethread
- temples_conciergehistory
- temples_conciergeusage
- temples_concierge_recommendation_log
- temples_concierge_recommendation_click_log
- temples_featureusage

### D. 御朱印・お気に入り・反応系テーブル
ユーザー操作に関わるが、今回の concierge 復旧とは別束で扱う。C と混ぜて修復しない。

- temples_goshuin
- temples_goshuinimage
- temples_favorite
- temples_like
- temples_rankinglog

### E. 収集・キャッシュ系テーブル
運用補助・収集処理・キャッシュ用途の可能性が高い。主系統の修復完了後に扱う。

- temples_crawltile
- temples_placecache
- temples_placesseed
- temples_placesseedstate

## 修復順序の方針

修復は以下の順に進める。

1. C（concierge系）
2. A（基盤テーブル）
3. B（神社関連の中間・補助）
4. D（御朱印・お気に入り・反応系）
5. E（収集・キャッシュ系）

## 判断基準

- fake適用は「実体が既に存在し、列・制約も確認済み」のものに限定する
- 手動補完は「本番障害に直結し、定義が明確なもの」に限定する
- 全面再構築は最終手段とし、現時点では採用しない

※ この分類は実装上のモデル分類ではなく、本番整合回復のための運用上の修復単位として扱う。

## C束（concierge系）監査表

| table_name | 実体 | 列確認 | index/constraint確認 | migration履歴整合 | 判定 |
|---|---|---|---|---|---|
| temples_conciergemessage | Yes | 確認済み | 確認済み | 要確認 | 維持候補 |
| temples_conciergethread | Yes | 確認済み | 確認済み | 要確認 | 維持候補 |
| temples_conciergehistory | No | - | - | 不整合の可能性 | 要修復候補 |
| temples_conciergeusage | Yes | 確認済み | 確認済み | 要確認 | 維持候補 |
| temples_concierge_recommendation_log | Yes | 確認済み | 確認済み | 要確認 | 維持候補 |
| temples_concierge_recommendation_click_log | No | - | - | 不整合の可能性 | 要保留候補 |
| temples_featureusage | Yes | 確認済み | 確認済み | fake適用済み | 維持 |


### 中間判断
C束は 7 テーブル中 5 テーブルの実体を確認。
`temples_conciergehistory` と `temples_concierge_recommendation_click_log` は本番に存在せず、
C束の未修復候補として扱う。
一方で `temples_concierge_recommendation_log` は index / FK / NOT NULL を確認できており、
本番実体としては比較的整っている。

### C束の欠損2テーブルの必要性判断

#### temples_conciergehistory
- 現時点では本番主機能の必須土台ではない
- `thread` / `message` 系で主導線が成立しているため、即時修復対象にはしない
- 旧履歴導線または互換資産の可能性があるため、参照コード確認後に要否を再判定する

#### temples_concierge_recommendation_click_log
- 推薦クリック観測のための補助テーブルとみなす
- 観測・分析価値はあるが、現時点で API 主契約の必須土台ではない
- 即時修復対象にはせず、保存コードの有無と利用目的を確認後に再判定する

### 現時点の判断
C束の欠損2テーブルは、いずれも「無いと本番主機能が壊れる」カテゴリではない。
したがって、C束の即時修復対象からは外し、保留管理とする。

### 欠損2テーブルの参照コード確認結果

#### temples_conciergehistory

- model: 存在
- migration: 存在しない
- DB: 本番に存在しない
- usage: 実行コードから参照なし
- API/UI: 定義のみ存在

→ 判定:
未実装機能の残骸（ゴーストテーブル）

→ リスク:
- 将来的にAPI叩いたときに500になる可能性
- migrationで再現できない

→ 方針:
削除 or 正式実装のどちらかに寄せる必要あり

#### temples_concierge_recommendation_click_log
- migration / model 定義は存在
- ただし保存処理の参照は現時点で確認できていない
- 直近の本番主機能に必須とは言い切れないため、要保留候補として扱う

## C束 修復方針（確定）

### 方針
- 必要最小限の修復のみ行う
- スコープは1テーブル単位で管理する

### 修復対象
- temples_conciergehistory
  - 理由: API / frontend / serializer で参照あり
  - 状態: 本番DBに実体なし
  - 判定: 要修復（必須）

### 保留対象
- temples_concierge_recommendation_click_log
  - 理由: 参照コードはあるが保存処理未確認
  - 状態: 本番DBに実体なし
  - 判定: 要保留

### 非対象
- その他C束テーブル
  - 状態: 実体 / index / constraint 確認済み
  - 判定: 維持
