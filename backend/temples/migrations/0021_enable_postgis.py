from django.db import migrations
from django.contrib.postgres.operations import CreateExtension


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        ("temples", "0020_shrine_popularity_fields"),
    ]
    operations = [
        CreateExtension("postgis"),  # DBにpostgis拡張が無ければ有効化
        # 使うなら: CreateExtension("pg_trgm"), CreateExtension("btree_gist")
    ]
