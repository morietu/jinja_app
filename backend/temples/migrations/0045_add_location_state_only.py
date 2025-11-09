# 先頭にこれを追加（または置き換え）
from django.db import migrations
from django.contrib.gis.db.models.fields import PointField


class Migration(migrations.Migration):
    # 依存は 0029 に下げる（循環回避）
    dependencies = [
        ("temples", "0029_drop_auto_gist_location"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AlterField(
                    model_name="shrine",
                    name="location",
                    field=PointField(srid=4326, null=True, blank=True),
                ),
            ],
            database_operations=[],
        ),
    ]
