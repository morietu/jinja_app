# temples/migrations/0030_add_shrine_location_gist_concurrently.py
from django.db import migrations
from django.contrib.postgres.indexes import GistIndex
from django.contrib.postgres.operations import AddIndexConcurrently  # ←これ

INDEX_NAME = "shrine_location_gist"

class Migration(migrations.Migration):
    dependencies = [
        ("temples", "0029_drop_auto_gist_location"),
    ]
    # AddIndexConcurrently 自体が atomic=False を持つので明示不要

    operations = [
        AddIndexConcurrently(
            model_name="shrine",
            index=GistIndex(fields=["location"], name=INDEX_NAME),
        ),
    ]
