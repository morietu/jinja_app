from django.db import migrations


def enable_postgis(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cur:
        cur.execute("CREATE EXTENSION IF NOT EXISTS postgis;")


class Migration(migrations.Migration):
    dependencies = [("temples", "0024_alter_favorite_options_and_more")]
    operations = [
        migrations.RunPython(enable_postgis, reverse_code=migrations.RunPython.noop),
        # 以降に location 追加等があるなら既存の operations を続けてOK
    ]
