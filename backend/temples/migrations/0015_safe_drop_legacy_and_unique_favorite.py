# backend/temples/migrations/0015_safe_drop_legacy_and_unique_favorite.py
from django.conf import settings
from django.db import migrations

class Migration(migrations.Migration):
    dependencies = [
        ("temples", "0014_finalize_drop_legacy_name"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # 旧 unique_together を一旦外す（残す）
        migrations.AlterUniqueTogether(
            name="favorite",
            unique_together=set(),
        ),
        # Shrine 側の不要列を削除（残す）
        migrations.RemoveField(
            model_name="shrine",
            name="name",
        ),
        migrations.RemoveField(
            model_name="shrine",
            name="owner",
        ),
        # ❌ ここにあった AddConstraint(user, shrine) は削除（再追加しない）
    ]
