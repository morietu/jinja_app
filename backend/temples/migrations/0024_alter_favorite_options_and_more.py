# backend/temples/migrations/0024_alter_favorite_options_and_more.py
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("temples", "0023_fix_str_methods_and_indexes"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="favorite",
            options={"ordering": ("-created_at",)},
        ),
        # ❗ ここを set() にして、('user','shrine') を再び有効化しない
        migrations.AlterUniqueTogether(
            name="favorite",
            unique_together=set(),
        ),
        migrations.AddIndex(
            model_name="favorite",
            index=models.Index(fields=["user", "created_at"], name="idx_fav_user_created"),
        ),
    ]
