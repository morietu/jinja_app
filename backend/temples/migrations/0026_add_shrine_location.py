# backend/temples/migrations/0026_add_shrine_location.py
from django.db import migrations, models


def _ensure_location_field(apps, schema_editor):
    conn = schema_editor.connection
    Shrine = apps.get_model("temples", "Shrine")
    table = Shrine._meta.db_table

    # 既存カラム確認（失敗時は安全にスキップ）
    try:
        with conn.cursor() as cursor:
            existing = [c.name for c in conn.introspection.get_table_description(cursor, table)]
    except Exception:
        return
    if "location" in existing:
        return

    # 接続バックエンドのGIS対応可否で分岐（これが重要）
    use_gis_backend = hasattr(conn.ops, "geo_db_type")

    if use_gis_backend:
        # PostGIS backend のときだけ PointField を使う
        try:
            from django.contrib.gis.db.models import PointField

            field = PointField(srid=4326, null=True, blank=True)
        except Exception:
            # 念のためのフォールバック
            field = models.BinaryField(null=True, blank=True)
    else:
        # 非GISバックエンドでは汎用型で保持
        field = models.BinaryField(null=True, blank=True)

    # フィールド名のメタ付与
    try:
        field.set_attributes_from_name("location")
    except Exception:
        pass

    # 追加
    schema_editor.add_field(Shrine, field)


class Migration(migrations.Migration):
    dependencies = [
        ("temples", "0025_enable_postgis_and_add_location"),
    ]

    operations = [
        migrations.RunPython(_ensure_location_field, reverse_code=migrations.RunPython.noop),
    ]
