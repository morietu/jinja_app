from django.db import migrations
from django.contrib.postgres.indexes import GistIndex
from django.contrib.postgres.operations import AddIndexConcurrently

INDEX_NAME = "shrine_location_gist"

class Migration(migrations.Migration):
    # ★ これが必須：CONCURRENTLY系はトランザクション外で実行する
    atomic = False

    # location を追加済みのマイグレーション以降に依存させる
    dependencies = [
        ("temples", "0029_drop_auto_gist_location"),
    ]

    operations = [
        AddIndexConcurrently(
            model_name="shrine",
            index=GistIndex(fields=["location"], name=INDEX_NAME),
        ),
    ]
