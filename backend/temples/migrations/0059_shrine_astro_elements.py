# backend/temples/migrations/0059_shrine_astro_elements.py
from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ("temples", "0044_deity_remove_conciergesession_user_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="shrine",
            name="astro_elements",
            field=models.JSONField(
                default=list,
                blank=True,
                help_text="西洋占星術エレメント: ['火','土','風','水']",
            ),
        ),
    ]
