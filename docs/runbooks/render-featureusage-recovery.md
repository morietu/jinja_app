# 🛠 Render 本番 FeatureUsage 復旧手順

## 1. 事象

- `/api/concierge/chat/` のみ 500
- `/healthz/` は 200
- `/api/shrines/` は 200
- plan API は正常、chat API のみ異常

---

## 2. 原因

- FeatureUsage モデルを参照するコードが本番にデプロイ済み
- しかし本番DBに `temples_featureusage` テーブルが存在しない
- `django_migrations` と実テーブルが不整合

---

## 3. 確認コマンド

### migration確認

```sql
SELECT app, name, applied
FROM django_migrations
WHERE app = 'temples'
ORDER BY name;
```

### テーブル確認

```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'temples_%'
ORDER BY tablename;
```

### API確認

```bash
curl -i https://jinja-backend.onrender.com/healthz/

curl -i -X POST https://jinja-backend.onrender.com/api/concierge/chat/ \
  -H "Content-Type: application/json" \
  -d '{"query":"仕事運を上げたい","lat":35.68,"lng":139.76}'
```

---

## 4. 復旧手順(手動)

### テーブル作成

```sql
CREATE TABLE temples_featureusage (
  id BIGSERIAL PRIMARY KEY,
  scope VARCHAR(16) NOT NULL,
  anon_id VARCHAR(64) NOT NULL DEFAULT '',
  feature VARCHAR(32) NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id BIGINT NULL
);
```

### 外部キー(auth_user)

```sql
ALTER TABLE temples_featureusage
ADD CONSTRAINT temples_featureusage_user_id_fk
FOREIGN KEY (user_id) REFERENCES auth_user(id)
ON DELETE CASCADE;
```

---

## 5. インデックス・制約

### index

```sql
CREATE INDEX temples_fea_scope_16bb7d_idx
ON temples_featureusage (scope, feature);

CREATE INDEX temples_fea_user_id_ed3ce9_idx
ON temples_featureusage (user_id, feature);

CREATE INDEX temples_fea_anon_id_6f0176_idx
ON temples_featureusage (anon_id, feature);
```

### unique

```sql
CREATE UNIQUE INDEX uq_feature_usage_user_feature
ON temples_featureusage (user_id, feature)
WHERE scope = 'user' AND user_id IS NOT NULL;

CREATE UNIQUE INDEX uq_feature_usage_anon_feature
ON temples_featureusage (anon_id, feature)
WHERE scope = 'anonymous' AND anon_id <> '';
```

### check constraint

```sql
ALTER TABLE temples_featureusage
ADD CONSTRAINT chk_feature_usage_scope_target
CHECK (
  (scope = 'user' AND user_id IS NOT NULL AND anon_id = '')
  OR
  (scope = 'anonymous' AND user_id IS NULL AND anon_id <> '')
);
```

---

## 6. 復旧確認

### テーブル確認

```sql
SELECT * FROM temples_featureusage LIMIT 10;
```

### index確認

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'temples_featureusage';
```

### constraint確認

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'temples_featureusage'::regclass;
```

### API確認

- 200が返ること
- レコメンドが返ること

---

## 7. 状態

- アプリ: 復旧済み
- DB: 手動補完済み
- migration: 未整合(別タスク)

---
