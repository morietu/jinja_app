
from django.db import migrations

INDEX_NAME = "shrine_location_gist"

def ensure_gist_index(apps, schema_editor):
    # PostgreSQL 以外は何もしない（SQLite ではスキップ）
    if schema_editor.connection.vendor != "postgresql":
        return

    # 既に index があるか確認
    with schema_editor.connection.cursor() as cur:
        cur.execute('DROP INDEX IF EXISTS public."%s";' % INDEX_NAME)
        exists = cur.fetchone() is not None

    if exists:
        return

    # Django の GiSTIndex を使って作成（USING GIST の生SQLは使わない）
    
    from django.contrib.postgres.indexes import GistIndex
    Shrine = apps.get_model("temples", "Shrine")
    index = GiSTIndex(fields=["location"], name=INDEX_NAME)
    # 既存重複に備えて例外は握りつぶし
    try:
        schema_editor.add_index(Shrine, index)
    except Exception:
        pass


def noop_reverse(apps, schema_editor):
    # 逆方向ではインデックスは落とさない（従来同様に運用）
    if schema_editor.connection.vendor != "postgresql":
        return
    # 必要なら以下を有効化：
    # with schema_editor.connection.cursor() as cur:
    #     cur.execute("DROP INDEX IF EXISTS public.%s;" % INDEX_NAME)

class Migration(migrations.Migration):
    dependencies = [("temples", "0029_drop_auto_gist_location")]
    # もう CONCURRENTLY を使わないので atomic=True のままでOK
    operations = [
        migrations.RunPython(ensure_gist_index, reverse_code=noop_reverse),
    ]
