# backend/temples/migrations/0030_add_shrine_location_gist_concurrently.py
from django.db import migrations, ProgrammingError

INDEX_NAME = "shrine_location_gist"

def create_gist_if_geometry(apps, schema_editor):
    conn = schema_editor.connection

    # PostGIS backend でなければ何もしない
    if not hasattr(conn.ops, "geo_db_type"):
        return

    with conn.cursor() as cur:
        # カラムの実体型が geometry か確認（スキーマは current_schema() を明示）
        cur.execute("""
            SELECT c.udt_name
            FROM information_schema.columns c
            WHERE c.table_schema = current_schema()
              AND c.table_name = 'temples_shrine'
              AND c.column_name = 'location'
        """)
        row = cur.fetchone()
        if not row or row[0] != "geometry":
            return

        # 既存インデックス確認（スキーマは current_schema() を明示）
        cur.execute("""
            SELECT 1
            FROM pg_indexes
            WHERE schemaname = current_schema()
              AND indexname = %s
        """, [INDEX_NAME])
        if cur.fetchone():
            return

        # 競合をさらに安全に：IF NOT EXISTS + duplicateエラー握りつぶし
        try:
            cur.execute(
                f'CREATE INDEX CONCURRENTLY IF NOT EXISTS "{INDEX_NAME}" '
                'ON "temples_shrine" USING GIST ("location");'
            )
        except ProgrammingError as e:
            # 並行作成競合など、既存ならスキップ（ログ抑制）
            # e.pgcode == '42710'（duplicate_object）等を見てもよい
            conn.rollback()

class Migration(migrations.Migration):
    atomic = False  # CONCURRENTLY のため必須
    dependencies = [
        ("temples", "0029_drop_auto_gist_location"),
    ]
    operations = [
        migrations.RunPython(create_gist_if_geometry, migrations.RunPython.noop),
    ]
