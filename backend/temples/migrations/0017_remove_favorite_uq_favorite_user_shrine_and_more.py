# backend/temples/migrations/0017_remove_favorite_uq_favorite_user_shrine_and_more.py
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def drop_favorite_constraints_pg(apps, schema_editor):
    """
    旧制約が DB に残っている環境向けの安全な削除。
    PostgreSQL のみ実行。SQLite などでは no-op。
    """
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cur:
        # どちらも「存在すれば」落とす（存在しなければ no-op）
        cur.execute("ALTER TABLE temples_favorite DROP CONSTRAINT IF EXISTS uq_favorite_user_shrine;")
        cur.execute("ALTER TABLE temples_favorite DROP CONSTRAINT IF EXISTS uq_favorite_user_place;")


class Migration(migrations.Migration):
    dependencies = [
        ("temples", "0016_placeref_alter_goriyakutag_options_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # 以降はフィールド変更（そのまま）
        migrations.AddField(
            model_name="favorite",
            name="place_id",
            field=models.CharField(blank=True, db_index=True, max_length=128, null=True),
        ),
        migrations.AlterField(
            model_name="favorite",
            name="shrine",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="favorited_by",
                to="temples.shrine",
            ),
        ),

        # 旧 UniqueConstraint を「DB上に残っている場合のみ」安全に除去
        # ※ モデル状態には何も追加/削除しない（RemoveConstraint は状態に制約が無いと ValueError になるため使わない）
        migrations.RunPython(drop_favorite_constraints_pg, reverse_code=migrations.RunPython.noop),
    ]
