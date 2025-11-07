from django.db import migrations

def enable_postgis(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cur:
        cur.execute("CREATE EXTENSION IF NOT EXISTS postgis;")

class Migration(migrations.Migration):
    dependencies = [("temples", "0020_shrine_popularity_fields")]  # 実履歴に合わせて
    operations = [
        migrations.RunPython(enable_postgis, reverse_code=migrations.RunPython.noop),
    ]
