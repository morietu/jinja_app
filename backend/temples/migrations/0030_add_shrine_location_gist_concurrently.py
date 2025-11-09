from django.db import migrations

INDEX_NAME = "shrine_location_gist"

def create_gist_if_geometry(apps, schema_editor):
    conn = schema_editor.connection

    # PostGIS backend でなければ何もしない
    if not hasattr(conn.ops, "geo_db_type"):
        return

    # カラムの実体型が geometry のときだけ作成
    with conn.cursor() as cur:
        cur.execute("""
            SELECT c.udt_name
            FROM information_schema.columns c
            WHERE c.table_name = 'temples_shrine' AND c.column_name = 'location'
        """)
        row = cur.fetchone()
        if not row:
            return
        udt = row[0]  # 'geometry' 期待
        if udt != "geometry":
            return

        # 既存確認してから CONCURRENTLY で作成
        cur.execute("""
            SELECT 1 FROM pg_indexes
            WHERE schemaname = 'public' AND indexname = %s
        """, [INDEX_NAME])
        exists = cur.fetchone()
        if exists:
            return

        cur.execute(
            f'CREATE INDEX CONCURRENTLY "{INDEX_NAME}" '
            'ON "temples_shrine" USING GIST ("location");'
        )

class Migration(migrations.Migration):
    atomic = False  # CONCURRENTLY のため必須
    dependencies = [
        ("temples", "0029_drop_auto_gist_location"),
    ]
    operations = [
        migrations.RunPython(create_gist_if_geometry, migrations.RunPython.noop),
    ]
