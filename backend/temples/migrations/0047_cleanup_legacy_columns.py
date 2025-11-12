# -*- coding: utf-8 -*-
from django.db import migrations

def forwards(apps, schema_editor):
    vendor = schema_editor.connection.vendor  # 'postgresql' or 'sqlite'
    with schema_editor.connection.cursor() as cur:
        if vendor == "postgresql":
            # ViewLike テーブル（存在すれば削除）
            cur.execute("DROP TABLE IF EXISTS public.temples_viewlike CASCADE;")
            # 残存列（存在すれば削除）
            cur.execute("ALTER TABLE public.temples_conciergehistory DROP COLUMN IF EXISTS shrine_id;")
            cur.execute("ALTER TABLE public.temples_goshuin DROP COLUMN IF EXISTS shrine_id;")
            cur.execute("ALTER TABLE public.temples_goshuin DROP COLUMN IF EXISTS user_id;")
            cur.execute("ALTER TABLE public.temples_visit DROP COLUMN IF EXISTS shrine_id;")
            cur.execute("ALTER TABLE public.temples_visit DROP COLUMN IF EXISTS user_id;")
        else:
            # SQLite: CASCADE不可・スキーマ修飾不可
            try:
                cur.execute("DROP TABLE IF EXISTS temples_viewlike;")
            except Exception:
                pass
            # SQLite 3.35+ は DROP COLUMN 対応。古い場合は実害なし（列が無い想定）。
            for sql in (
                "ALTER TABLE temples_conciergehistory DROP COLUMN IF EXISTS shrine_id;",
                "ALTER TABLE temples_goshuin DROP COLUMN IF EXISTS shrine_id;",
                "ALTER TABLE temples_goshuin DROP COLUMN IF EXISTS user_id;",
                "ALTER TABLE temples_visit DROP COLUMN IF EXISTS shrine_id;",
                "ALTER TABLE temples_visit DROP COLUMN IF EXISTS user_id;",
            ):
                try:
                    cur.execute(sql)
                except Exception:
                    # 古いSQLite等でDROP COLUMN未対応ならノーオペで進む
                    pass

def noop(apps, schema_editor):
    # 復元不要（クリーンアップのみ）
    pass

class Migration(migrations.Migration):
    dependencies = [
        ("temples", "0046_merge_20251109_1248"),
    ]

    operations = [
        migrations.RunPython(forwards, noop),
    ]
