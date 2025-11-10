# backend/temples/migrations/0018_remove_favorite_uq_favorite_user_shrine_and_more.py
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("temples", "0017_remove_favorite_uq_favorite_user_shrine_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # 念のため外す（存在しなくても no-op）
        migrations.AddConstraint(  # ← 以降はそのまま（条件付きの付け直し等）
            model_name="favorite",
            constraint=models.UniqueConstraint(
                condition=models.Q(("shrine__isnull", False)),
                fields=("user", "shrine"),
                name="uq_favorite_user_shrine",
            ),
        ),
        migrations.AddConstraint(
            model_name="favorite",
            constraint=models.UniqueConstraint(
                condition=models.Q(("place_id__isnull", False)),
                fields=("user", "place_id"),
                name="uq_favorite_user_place",
            ),
        ),
        # ❌ 以下の AddConstraint (user, shrine) / (user, place_id) は削除（再追加しない）
    ]
