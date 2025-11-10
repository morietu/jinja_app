# backend/temples/migrations/0033_fix_location_geometry.py
from django.db import migrations

INDEX_NAME = "shrine_location_gist"


def fix_location_and_index(apps, schema_editor):
    # PostgreSQL 以外は何もしない（SQLite ではスキップ）
    if schema_editor.connection.vendor != "postgresql":
        return

    with schema_editor.connection.cursor() as cur:
        # location 列の存在＆型を確認
        cur.execute(
            """
            SELECT data_type, udt_name
            FROM information_schema.columns
            WHERE table_schema='public'
              AND table_name='temples_shrine'
              AND column_name='location'
            """
        )
        row = cur.fetchone()
        data_type = row[0].lower() if row and row[0] else None
        udt_name = row[1].lower() if row and row[1] else None
        # bytea → geometry(Point,4326) に作り直し
        if data_type == "bytea":
            cur.execute('ALTER TABLE public.temples_shrine DROP COLUMN "location";')
            cur.execute(
                "ALTER TABLE public.temples_shrine " 'ADD COLUMN "location" geometry(Point,4326);'
            )
        # そもそも列が無ければ追加
        elif row is None:
            cur.execute(
                "ALTER TABLE public.temples_shrine " 'ADD COLUMN "location" geometry(Point,4326);'
            )
        # geometry(=udt_name='geometry') なら何もしない

    # GiST index を Django API で作成（USING GIST の生SQLは使わない）
    try:
        from django.contrib.postgres.indexes import GistIndex

        Shrine = apps.get_model("temples", "Shrine")

        # 既存確認
        with schema_editor.connection.cursor() as cur:
            cur.execute('DROP INDEX IF EXISTS public."%s";' % INDEX_NAME)
            exists = cur.fetchone() is not None

        if not exists:
            index = GiSTIndex(fields=["location"], name=INDEX_NAME)
            try:
                schema_editor.add_index(Shrine, index)
            except Exception:
                pass
    except Exception:
        # GeoDjango の import に失敗するなどのケースは黙ってスキップ
        pass


def drop_index_reverse(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cur:
        cur.execute("DROP INDEX IF EXISTS public.%s;" % INDEX_NAME)


class Migration(migrations.Migration):
    dependencies = [("temples", "0032_shrine_location_alter_shrine_latitude_and_more")]
    operations = [
        migrations.RunPython(fix_location_and_index, reverse_code=drop_index_reverse),
    ]
