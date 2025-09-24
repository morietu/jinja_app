from django.db import migrations
from django.contrib.postgres.operations import CreateExtension


def _enable_postgis(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cur:
        cur.execute("CREATE EXTENSION IF NOT EXISTS postgis")


def _noop(apps, schema_editor):
    return


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        ("temples", "0020_shrine_popularity_fields"),
    ]
    operations = [
        CreateExtension("postgis"),  # DBにpostgis拡張が無ければ有効化
        migrations.RunPython(_enable_postgis, _noop),
        # 使うなら: CreateExtension("pg_trgm"), CreateExtension("btree_gist")
    ]
