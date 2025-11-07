from django.db import migrations, models

def ensure_pg_trgm(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cur:
        cur.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")

def create_perf_indexes(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cur:
        # 位置情報: 近傍検索用 GiST（PostGIS）
        cur.execute("""
            CREATE INDEX CONCURRENTLY IF NOT EXISTS shrine_loc_gist
            ON temples_shrine USING GIST (location);
        """)
        # 部分一致: GIN + trigram
        cur.execute("""
            CREATE INDEX CONCURRENTLY IF NOT EXISTS shrine_namejp_trgm
            ON temples_shrine USING GIN (name_jp gin_trgm_ops);
        """)
        cur.execute("""
            CREATE INDEX CONCURRENTLY IF NOT EXISTS shrine_addr_trgm
            ON temples_shrine USING GIN (address gin_trgm_ops);
        """)
        cur.execute("""
            CREATE INDEX CONCURRENTLY IF NOT EXISTS shrine_goriyaku_trgm
            ON temples_shrine USING GIN (goriyaku gin_trgm_ops);
        """)

def drop_perf_indexes(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cur:
        for name in [
            "shrine_loc_gist",
            "shrine_namejp_trgm",
            "shrine_addr_trgm",
            "shrine_goriyaku_trgm",
        ]:
            cur.execute(f"DROP INDEX IF EXISTS {name};")

class Migration(migrations.Migration):
    # CONCURRENTLY を使うのでトランザクション外
    atomic = False
    dependencies = [("temples", "0035_shrine_uq_shrine_name_loc_and_more")]
    operations = [
        migrations.RunPython(ensure_pg_trgm, reverse_code=migrations.RunPython.noop),
        migrations.RunPython(create_perf_indexes, reverse_code=drop_perf_indexes),
        # 2) タグ名: 精確一致の高速化（B-Tree）→ これはどのDBでもOK
        migrations.AlterField(
            model_name="goriyakutag",
            name="name",
            field=models.CharField(max_length=100, db_index=True),
        ),
        # 4) お気に入りの並び替え用（追加順フォールバック）→ どのDBでもOK
        migrations.AddIndex(
            model_name="favorite",
            index=models.Index(
                fields=["user", "shrine", "created_at"],
                name="fav_user_shrine_created",
            ),
        ),
        migrations.AddIndex(
            model_name="favorite",
            index=models.Index(
                fields=["user", "created_at"],
                name="fav_user_created",
            ),
        ),
    ]
