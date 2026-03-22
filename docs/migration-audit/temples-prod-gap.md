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
