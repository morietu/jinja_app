from django.db import migrations, connection


def create_gist_index(apps, schema_editor):
    # Only run on PostgreSQL
    if connection.vendor != "postgresql":
        return

    with schema_editor.connection.cursor() as cur:
        cur.execute(
            "CREATE INDEX IF NOT EXISTS shrine_location_gist ON temples_shrine USING GIST (location);"
        )


def drop_gist_index(apps, schema_editor):
    if connection.vendor != "postgresql":
        return

    with schema_editor.connection.cursor() as cur:
        cur.execute("DROP INDEX IF EXISTS shrine_location_gist;")


class Migration(migrations.Migration):
    atomic = False  # CONCURRENTLY には必須
    dependencies = [
        ("temples", "0029_drop_auto_gist_location"),
    ]
    operations = [
        migrations.RunPython(create_gist_index, reverse_code=drop_gist_index),
    ]
