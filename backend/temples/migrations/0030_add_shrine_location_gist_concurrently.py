from django.db import migrations
from django.contrib.postgres.indexes import GistIndex
from django.contrib.postgres.operations import CreateIndexConcurrently

INDEX_NAME = "shrine_loc_gist"

class Migration(migrations.Migration):
    # CONCURRENTLY を使うため必須
    atomic = False

    dependencies = [
        ("temples", "0029_drop_auto_gist_location"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            # DB：CONCURRENTLY で実体を作成（既存なら何もしない）
            database_operations=[
                CreateIndexConcurrently(
                    model_name="shrine",
                    index=GistIndex(fields=["location"], name=INDEX_NAME),
                ),
            ],
            # State：Django のモデル状態にも Index を登録
            state_operations=[
                migrations.AddIndex(
                    model_name="shrine",
                    index=GistIndex(fields=["location"], name=INDEX_NAME),
                ),
            ],
        ),
    ]
