# backend/temples/migrations/0037_drop_dup_gist.py
from django.db import migrations


def drop_duplicate_gist(apps, schema_editor):
    # PostgreSQL 以外（SQLite等）では何もしない
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cur:
        # 重複している可能性のある GiST を落として、必要なら作り直す
        cur.execute("DROP INDEX IF EXISTS shrine_loc_gist;")
        cur.execute(
            """
            CREATE INDEX CONCURRENTLY IF NOT EXISTS shrine_loc_gist
            ON temples_shrine USING GIST (location);
        """
        )


class Migration(migrations.Migration):
    # CONCURRENTLY を使うのでトランザクション外
    atomic = False
    dependencies = [("temples", "0036_perf_indexes")]
    operations = [
        migrations.RunPython(drop_duplicate_gist, reverse_code=migrations.RunPython.noop),
    ]
