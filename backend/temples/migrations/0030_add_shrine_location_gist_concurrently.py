# temples/migrations/0030_add_shrine_location_gist_concurrently.py
from django.db import migrations

INDEX_NAME = "shrine_location_gist"


def create_gist_index(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cur:
        # すでに存在すれば何もしない（CONCURRENTLY + IF NOT EXISTS はPGでOK）
        cur.execute(
            f"""
            CREATE INDEX IF NOT EXISTS {INDEX_NAME}
            ON temples_shrine
            USING GIST (location);
            """
        )


def drop_gist_index(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cur:
        cur.execute(
            """
        DO $$
        DECLARE v_typ text;
        BEGIN
          SELECT data_type INTO v_typ
          FROM information_schema.columns
          WHERE table_schema='public' AND table_name='temples_shrine' AND column_name='location';

          -- geometry のときだけ（bytea のときは何もしない）
          IF v_typ IS NULL OR v_typ <> 'USER-DEFINED' THEN
            RETURN;
          END IF;

          -- 念のため
          CREATE INDEX IF NOT EXISTS shrine_location_gist
            ON public.temples_shrine USING GIST (location);
        END $$;
        """
        )


def drop_gist_index(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cur:
        cur.execute("DROP INDEX IF EXISTS public.shrine_location_gist;")


class Migration(migrations.Migration):
    dependencies = [("temples", "0029_drop_auto_gist_location")]
    operations = []
