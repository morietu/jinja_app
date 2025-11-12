# backend/temples/migrations/0047_cleanup_legacy_columns.py
from django.db import migrations

SQL_FORWARD = """
-- 0043/0044 以前の残骸を安全に除去（存在すればDROP）

-- 旧 ViewLike テーブル
DROP TABLE IF EXISTS public.temples_viewlike CASCADE;

-- ConciergeHistory: shrine_id列（0043でDROPされるはずの残存）
ALTER TABLE public.temples_conciergehistory
  DROP COLUMN IF EXISTS shrine_id;

-- Goshuin: shrine_id/user_id列（0043でDROPされるはずの残存）
ALTER TABLE public.temples_goshuin
  DROP COLUMN IF EXISTS shrine_id,
  DROP COLUMN IF EXISTS user_id;

-- Visit: shrine_id/user_id列（0043でDROPされるはずの残存）
ALTER TABLE public.temples_visit
  DROP COLUMN IF EXISTS shrine_id,
  DROP COLUMN IF EXISTS user_id;

-- 一時的に付けた可能性のある一時FK/制約名の掃除（存在すれば）
ALTER TABLE public.temples_rankinglog
  DROP CONSTRAINT IF EXISTS temples_rankinglog_shrine_id_fk_tmp;

ALTER TABLE public.temples_favorite
  DROP CONSTRAINT IF EXISTS temples_favorite_user_id_fk,
  DROP CONSTRAINT IF EXISTS temples_favorite_shrine_id_fk;

-- 念のため、期待ユニーク制約（shrine_id, date）は既に正規マイグレーションで作成済み。
-- ここでは追加作業はしない（差分があれば正規マイグレが失敗して検知できる）。
"""

SQL_BACKWARD = """
-- 逆遷移はNo-Op（安全弾のため復元しない）
"""

class Migration(migrations.Migration):

    dependencies = [
        ("temples", "0046_merge_20251109_1248"),
    ]

    operations = [
        migrations.RunSQL(SQL_FORWARD, SQL_BACKWARD),
    ]
    
