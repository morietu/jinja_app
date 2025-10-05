from django.db import migrations


class Migration(migrations.Migration):
    # 直前の番号に合わせて依存関係を修正
    dependencies = [
        ("temples", "0036_perf_indexes"),
    ]

    # CONCURRENTLY を使うためにトランザクション外で実行
    atomic = False

    operations = [
        migrations.RunSQL(
            # 旧インデックスだけ落とす（存在しなければ何もしない）
            sql="DROP INDEX CONCURRENTLY IF EXISTS shrine_loc_gist;",
            reverse_sql="""
                -- 逆マイグレーション（必要なら再作成）
                CREATE INDEX CONCURRENTLY IF NOT EXISTS shrine_loc_gist
                ON temples_shrine
                USING GIST (location);
            """,
        ),
    ]
