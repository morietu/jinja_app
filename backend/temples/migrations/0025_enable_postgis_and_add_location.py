from django.db import migrations
from django.contrib.gis.db.models import PointField


def _enable_postgis(apps, schema_editor):
    # PostgreSQL のときだけ PostGIS を有効化。SQLite/Spatialite では何もしない
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cur:
        cur.execute("CREATE EXTENSION IF NOT EXISTS postgis")


class Migration(migrations.Migration):
    dependencies = [
        ("temples", "0024_alter_favorite_options_and_more"),
    ]

    operations = [
        migrations.RunPython(_enable_postgis, migrations.RunPython.noop),
        migrations.AddField(
            model_name="shrine",
            name="location",
            field=PointField(srid=4326, null=True, blank=True),
        ),
    ]
