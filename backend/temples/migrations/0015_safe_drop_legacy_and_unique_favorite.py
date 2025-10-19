# backend/temples/migrations/0015_safe_drop_legacy_and_unique_favorite.py

from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("temples", "0014_finalize_drop_legacy_name"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # 旧 unique_together を一旦外す
        migrations.AlterUniqueTogether(
            name="favorite",
            unique_together=set(),
        ),
        # ✅ SQLite / PostgreSQL どちらでも安全に列を削除できる標準オペレーション
        migrations.RemoveField(
            model_name="shrine",
            name="name",
        ),
        migrations.RemoveField(
            model_name="shrine",
            name="owner",
        ),
        # 新しいユニーク制約を付け直す（user, shrine の組み合わせで一意）
        migrations.AddConstraint(
            model_name="favorite",
            constraint=models.UniqueConstraint(
                fields=("user", "shrine"),
                name="uq_favorite_user_shrine",
            ),
        ),
    ]
