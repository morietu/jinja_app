# backend/temples/migrations/0030_add_shrine_location_gist_concurrently.py
from django.db import migrations
from django.contrib.postgres.indexes import GistIndex

INDEX_NAME = "shrine_loc_gist"  # 63文字制限を安全にクリア

class Migration(migrations.Migration):
    # ※ 0029 で自動GiSTは落としている前提
    dependencies = [
        ("temples", "0029_drop_auto_gist_location"),
    ]

    # ここではトランザクション内で問題ない（CONCURRENTLY不要）
    # CONCURRENTLYが必要な本番は別途手動/後続マイグレーションで扱う想定
    operations = [
        migrations.AddIndex(
            model_name="shrine",
            index=GistIndex(
                name=INDEX_NAME,
                fields=["location"],
            ),
        ),
    ]
