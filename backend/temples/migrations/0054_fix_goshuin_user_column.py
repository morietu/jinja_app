# backend/temples/migrations/0054_fix_goshuin_user_column.py
from django.db import migrations


SQL = """
DO $$BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'temples_goshuin'
          AND column_name = 'user_id'
    ) THEN
        ALTER TABLE temples_goshuin
        ADD COLUMN user_id bigint NULL;
    END IF;
END;
$$;
"""


def forwards(apps, schema_editor):
    # テスト環境の SQLite では DO $$ が使えないのでスキップ
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute(SQL)


def backwards(apps, schema_editor):
    # 何もしない（本番の手当て用マイグレーションなのでロールバックも不要）
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("temples", "0053_alter_goshuin_user"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
