from django.db import migrations


def _maybe_enable_postgis(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cur:
        cur.execute("CREATE EXTENSION IF NOT EXISTS postgis")


class Migration(migrations.Migration):
    dependencies = [("temples", "0020_shrine_popularity_fields")]
    operations = [
        migrations.RunPython(_maybe_enable_postgis, reverse_code=migrations.RunPython.noop),
    ]
