# 例: migrations/0034_partial_unique_shrine_name_location.py
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("temples", "0033_fix_location_geometry")]
    operations = [
        migrations.RunSQL(
            sql=(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_shrine_name_loc "
                "ON temples_shrine (name_jp, address, location) "
                "WHERE location IS NOT NULL;"
            ),
            reverse_sql="DROP INDEX IF EXISTS uq_shrine_name_loc;",
        )
    ]
