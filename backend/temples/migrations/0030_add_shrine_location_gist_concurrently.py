# backend/temples/migrations/0030_add_shrine_location_gist_concurrently.py
from django.db import migrations
from django.contrib.postgres.indexes import GistIndex
from django.contrib.postgres.operations import AddIndexConcurrently

INDEX_NAME = "shrine_location_gist"

class Migration(migrations.Migration):
    # CONCURRENTLY 系はトランザクション外必須
    atomic = False

    # 依存は location 追加後の 0029 まで
    dependencies = [
        ("temples", "0029_drop_auto_gist_location"),
    ]

    operations = [
        AddIndexConcurrently(
            model_name="shrine",
            index=GistIndex(fields=["location"], name=INDEX_NAME),
        ),
    ]
