from django.db import migrations


def _ensure_location_field(apps, schema_editor):
    connection = schema_editor.connection
    Shrine = apps.get_model("temples", "Shrine")
    table_name = Shrine._meta.db_table
    cursor = connection.cursor()
    try:
        existing_cols = [
            c.name for c in connection.introspection.get_table_description(cursor, table_name)
        ]
    except Exception:
        # If introspection fails, skip safely.
        return

    if "location" in existing_cols:
        return

    # Add PointField; use GeoDjango field if available.
    try:
        from django.contrib.gis.db import models as gis_models

        field = gis_models.PointField(srid=4326, null=True, blank=True)
    except Exception:
        # Fallback to a generic BinaryField when GIS not available; nullable so safe.
        from django.db import models

        field = models.BinaryField(null=True, blank=True)

    # Bind field name so schema_editor can compute column and other attrs.
    try:
        field.set_attributes_from_name("location")
    except Exception:
        # Older Django versions or unusual field may not support this; ignore.
        pass

    schema_editor.add_field(Shrine, field)


class Migration(migrations.Migration):
    dependencies = [("temples", "0025_enable_postgis_and_add_location")]

    operations = [
        migrations.RunPython(_ensure_location_field, reverse_code=migrations.RunPython.noop)
    ]
