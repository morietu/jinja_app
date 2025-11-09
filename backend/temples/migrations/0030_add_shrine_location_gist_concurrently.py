from django.db import migrations
from django.contrib.postgres.indexes import GistIndex

INDEX_NAME = "temples_shrine_location_gist"

def ensure_gist_index(apps, schema_editor):
    # PostgreSQL 以外は何もしない（SQLite ではスキップ）
    if schema_editor.connection.vendor != "postgresql":
        return

    # 既存 index の存在確認
    with schema_editor.connection.cursor() as cur:
        cur.execute(
            """
            SELECT 1
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = %s AND n.nspname = 'public'
            """,
            [INDEX_NAME],
        )
        if cur.fetchone() is not None:
            return  # 既にあるので何もしない

    # なければ Django の Index API で作成
    Shrine = apps.get_model("temples", "Shrine")
    schema_editor.add_index(Shrine, GistIndex(fields=["location"], name=INDEX_NAME))

def drop_gist_index(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    # 結果セットを返さないので fetch* は呼ばないこと
    with schema_editor.connection.cursor() as cur:
        cur.execute(f'DROP INDEX IF EXISTS "public"."{INDEX_NAME}";')

class Migration(migrations.Migration):
    dependencies = [
        ("temples", "0029_drop_auto_gist_location"),
    ]

    operations = [
        migrations.RunPython(ensure_gist_index, drop_gist_index),
    ]
