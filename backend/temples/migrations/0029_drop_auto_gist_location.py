from django.db import migrations, connection


def drop_index(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        # SQLite: nothing to do
        return
    with schema_editor.connection.cursor() as cur:
        cur.execute("DROP INDEX IF EXISTS temples_shrine_location_0d10f279_id;")


def create_index(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cur:
        cur.execute(
            "CREATE INDEX IF NOT EXISTS temples_shrine_location_0d10f279_id ON temples_shrine USING GIST (location);"
        )


class Migration(migrations.Migration):
    dependencies = [
        ("temples", "0028_alter_favorite_unique_together_shrine_location"),
    ]
    operations = [
        migrations.RunPython(drop_index, reverse_code=create_index),
    ]
