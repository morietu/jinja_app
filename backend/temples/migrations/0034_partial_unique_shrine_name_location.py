# backend/temples/migrations/0034_partial_unique_shrine_name_location.py
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("temples", "0033_fix_location_geometry"),
    ]

    operations = [
        # 以前は手動で CREATE UNIQUE INDEX していたが、0035 の AddConstraint に統一。
        # 履歴だけ残すために no-op 化。
        migrations.RunSQL(sql="", reverse_sql=""),
    ]
