# backend/temples/migrations/0005_add_shrine_location.py
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("temples", "0004_enforce_nonnull_shrine_fields"),
    ]

    # ✅ ここでは何もしない（PostGIS拡張もlocation追加もやらない）
    operations = []
