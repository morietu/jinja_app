# Generated migration to add shrine FK to Goshuin

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("temples", "0048_conciergethread_conciergemessage_and_more"),
    ]

    operations = [
        # shrine を NOT NULL で追加（既存データはない想定）
        migrations.AddField(
            model_name="goshuin",
            name="shrine",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="goshuins",
                to="temples.shrine",
                null=False,
                default=1,  # 既存行があれば shrine_id=1 を使う（テスト用）
            ),
            preserve_default=False,
        ),
    ]
