# temples/migrations/0036_perf_indexes.py
from django.db import migrations, models


class Migration(migrations.Migration):
    # CREATE INDEX CONCURRENTLY を使うため、トランザクション外で実行
    atomic = False

    dependencies = [
        ("temples", "0035_shrine_uq_shrine_name_loc_and_more"),  # ← 最新の依存に直す
    ]

    operations = [
        # 0) pg_trgm を念のため有効化
        migrations.RunSQL(
            "CREATE EXTENSION IF NOT EXISTS pg_trgm;",
            reverse_sql=migrations.RunSQL.noop,
        ),
        # 1) 位置情報: 近傍検索用 GiST（PostGIS）
        migrations.RunSQL(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS shrine_loc_gist "
            "ON temples_shrine USING GIST (location);",
            reverse_sql="DROP INDEX IF EXISTS shrine_loc_gist;",
        ),
        # 2) タグ名: 精確一致の高速化（B-Tree）
        migrations.AlterField(
            model_name="goriyakutag",
            name="name",
            field=models.CharField(max_length=100, db_index=True),
        ),
        # 3) 部分一致（名前/住所/ご利益）: GIN + trigram
        migrations.RunSQL(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS shrine_namejp_trgm "
            "ON temples_shrine USING GIN (name_jp gin_trgm_ops);",
            reverse_sql="DROP INDEX IF EXISTS shrine_namejp_trgm;",
        ),
        migrations.RunSQL(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS shrine_addr_trgm "
            "ON temples_shrine USING GIN (address gin_trgm_ops);",
            reverse_sql="DROP INDEX IF EXISTS shrine_addr_trgm;",
        ),
        migrations.RunSQL(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS shrine_goriyaku_trgm "
            "ON temples_shrine USING GIN (goriyaku gin_trgm_ops);",
            reverse_sql="DROP INDEX IF EXISTS shrine_goriyaku_trgm;",
        ),
        # 4) お気に入りの並び替え用（追加順フォールバック）
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
