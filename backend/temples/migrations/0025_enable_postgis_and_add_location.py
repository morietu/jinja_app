from django.db import migrations

# GiSTIndex may not be available in environments without GeoDjango/PostGIS support.
try:
    from django.contrib.gis.db.models.indexes import GiSTIndex
except Exception:
    GiSTIndex = None


def _maybe_enable_postgis(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cur:
        cur.execute("CREATE EXTENSION IF NOT EXISTS postgis")


class Migration(migrations.Migration):
    dependencies = [("temples", "0024_alter_favorite_options_and_more")]

    ops = []

    # Ensure PostGIS extension is created only on PostgreSQL backends at migrate time.
    ops.append(migrations.RunPython(_maybe_enable_postgis, reverse_code=migrations.RunPython.noop))

    # Add GiST index only if GiSTIndex is importable and the model has 'location' field.
    def _maybe_add_gist_index(apps, schema_editor):
        if GiSTIndex is None:
            return
        Shrine = apps.get_model("temples", "Shrine")
        try:
            Shrine._meta.get_field("location")
        except Exception:
            return
        # Create the index using schema_editor (Postgres-only; no-op otherwise)
        index = GiSTIndex(fields=["location"], name="idx_shrine_location_gist")
        schema_editor.add_index(Shrine, index)

    ops.append(migrations.RunPython(_maybe_add_gist_index))

    operations = ops
