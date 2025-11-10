from django.db import migrations, ProgrammingError

INDEX_NAME = "temples_shrine_location_gix"


def create_gist_if_geometry(apps, schema_editor):
    conn = schema_editor.connection

    # ✅ Postgres 以外（SQLite/Spatialite等）は何もしない
    if getattr(conn, "vendor", None) != "postgresql":
        return
    # ✅ PostGIS backend でなければ何もしない
    if not hasattr(conn.ops, "geo_db_type"):
        return

    with conn.cursor() as cur:
        # location カラムの実体型を確認
        cur.execute(
            """
            SELECT c.udt_name
            FROM information_schema.columns c
            WHERE c.table_schema = current_schema()
              AND c.table_name = 'temples_shrine'
              AND c.column_name = 'location'
        """
        )
        row = cur.fetchone()
        udt = (row[0] if row else "").lower()
        if udt not in {"geometry", "geography"}:
            return

        # 既に同名インデックスがあるなら何もしない
        cur.execute(
            """
            SELECT 1
            FROM pg_indexes
            WHERE schemaname = current_schema()
              AND indexname = %s
        """,
            [INDEX_NAME],
        )
        if cur.fetchone():
            return

        # 競合を許容しつつ作成（トランザクション外: atomic=False）
        try:
            cur.execute(
                f'CREATE INDEX CONCURRENTLY IF NOT EXISTS "{INDEX_NAME}" '
                'ON "temples_shrine" USING GIST ("location");'
            )
        except ProgrammingError:
            # 並行作成競合などは握りつぶし
            conn.rollback()


def drop_index_if_exists(apps, schema_editor):
    conn = schema_editor.connection
    if getattr(conn, "vendor", None) != "postgresql":
        return
    with conn.cursor() as cur:
        try:
            cur.execute(f'DROP INDEX CONCURRENTLY IF EXISTS "{INDEX_NAME}";')
        except ProgrammingError:
            conn.rollback()


class Migration(migrations.Migration):
    atomic = False  # CONCURRENTLY に必須
    dependencies = [
        ("temples", "0029_drop_auto_gist_location"),
    ]
    operations = [
        migrations.RunPython(create_gist_if_geometry, drop_index_if_exists),
    ]
