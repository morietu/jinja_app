# temples/migrations/0033_fix_location_geometry.py
from django.db import migrations

SQL = r"""
DO $$
BEGIN
  -- temples_shrine.location が bytea のままなら geometry(Point,4326) に作り直す
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='temples_shrine'
      AND column_name='location'
      AND data_type='bytea'
  ) THEN
    ALTER TABLE public.temples_shrine DROP COLUMN location;
    ALTER TABLE public.temples_shrine ADD COLUMN location geometry(Point,4326);
  ELSIF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='temples_shrine'
      AND column_name='location'
  ) THEN
    -- location 列が無ければ追加
    ALTER TABLE public.temples_shrine ADD COLUMN location geometry(Point,4326);
  END IF;

  -- 念のため（環境によっては自動インデックスが無い場合がある）
  CREATE INDEX IF NOT EXISTS shrine_location_gist
    ON public.temples_shrine USING GIST (location);
END $$;
"""

REVERSE = r"""
-- 逆マイグレーションではインデックスだけ落とす（列は残す）
DROP INDEX IF EXISTS public.shrine_location_gist;
"""


class Migration(migrations.Migration):
    dependencies = [
        # あなたの 0031 ファイル名に合わせる
        ("temples", "0031_shrine_location_placeref_placeref_snapshot_gin_and_more"),
    ]
    operations = [
        migrations.RunSQL(SQL, reverse_sql=REVERSE),
    ]
