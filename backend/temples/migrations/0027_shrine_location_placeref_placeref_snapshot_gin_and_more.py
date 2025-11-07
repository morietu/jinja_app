from django.db import migrations

def _create_pg_indexes(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cur:
        # 拡張（存在しなければ作成）
        cur.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
        cur.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")

        # temples_placeref.snapshot_json → GIN(jsonb_path_ops)  ※jsonbの時だけ
        cur.execute("""
            SELECT format_type(a.atttypid, a.atttypmod)
            FROM pg_attribute a
            JOIN pg_class c ON a.attrelid = c.oid
            JOIN pg_namespace n ON c.relnamespace = n.oid
            WHERE n.nspname = 'public'
              AND c.relname = 'temples_placeref'
              AND a.attname = 'snapshot_json'
              AND a.attnum > 0 AND NOT a.attisdropped
        """)
        row = cur.fetchone()
        coltype = row[0].lower() if row and row[0] else None
        if coltype == "jsonb":
            cur.execute("""
                CREATE INDEX IF NOT EXISTS temples_placeref_snapshot_json_gin
                ON public.temples_placeref
                USING GIN (snapshot_json jsonb_path_ops)
            """)

        # temples_shrine.location → GiST(geometry) の時だけ
        cur.execute("""
            SELECT format_type(a.atttypid, a.atttypmod)
            FROM pg_attribute a
            JOIN pg_class c ON a.attrelid = c.oid
            JOIN pg_namespace n ON c.relnamespace = n.oid
            WHERE n.nspname = 'public'
              AND c.relname = 'temples_shrine'
              AND a.attname = 'location'
              AND a.attnum > 0 AND NOT a.attisdropped
        """)
        row = cur.fetchone()
        coltype = row[0].lower() if row and row[0] else None
        if coltype == "geometry":
            cur.execute("""
                CREATE INDEX IF NOT EXISTS temples_shrine_location_gist
                ON public.temples_shrine USING GIST (location)
            """)

def _drop_pg_indexes(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cur:
        cur.execute("DROP INDEX IF EXISTS public.temples_placeref_snapshot_json_gin;")
        cur.execute("DROP INDEX IF EXISTS public.temples_shrine_location_gist;")

class Migration(migrations.Migration):
    # CONCURRENTLY を使わないなら atomic=True でOK
    dependencies = [("temples", "0026_add_shrine_location")]
    operations = [
        migrations.RunPython(_create_pg_indexes, reverse_code=_drop_pg_indexes),
    ]
