"""W0-B02-T02 — remove the Production-only QA artefact `Shrine` pk 102.

`docs/audit/shrine-expansion-wave0-b02-t01-production-only-shrine-investigation.md`
`docs/audit/shrine-expansion-wave0-b02-t02-remove-qa-artifact-id102.md`

W0-B02 Reconciliation Gate が検出した唯一の `PROD_ONLY` 行
(`テスト確認神社 20260611` / `東京テスト`) と、その行だけが持つ監査済み
`ShrineInteractionLog` pk 3 / 6 を、fail-closed かつ可逆な data migration
として削除する。

Mother Ship 確定事項:

    W0_B02_T02_INTERACTION_LOG_POLICY = DELETE_EXACT_AUDITED_QA_LOGS_WITH_ARTIFACT
    W0_B02_T02_UPDATED_AT_POLICY      = EXACT_PRECONDITION_AND_REVERSE_VALUE

`P8-A` の `MOVE_TO_PRIMARY` は適用できない — pk 102 には対応する primary
Shrine が存在せず、log の移送先が無い。`P8-B` の「全 relation 0 件」も
満たさない — 監査済みの log が 2 行ある。したがって本 migration 限りの
policy として、**exact に pk 3 / 6 だけ**を artefact と同時に削除する。
この方針を他の user data / analytics data / QA data へ一般化しない。

PRE 定数はすべて Production の read-only PRE snapshot
(`scripts/migration_safety/sql/shrine_id102_pre_snapshot.sql`) の実測値で
あり、docs / fixtures / seed / local DB / 既存 migration からの推測値を
一切含まない。

fail-closed
-----------
いかなる mutation も、PRE 条件を**すべて**検証したあとにしか始まらない。
不一致は `PreconditionViolation` を送出し、`Migration.atomic`（Django 既定
`True`）により `RunPython` の transaction 全体が巻き戻り、0105 は適用済みと
して記録されない。修復も推測も部分 cleanup も行わない
（`temples.0097` / `0098` / `0099` / `0100` / `0101` と同じ契約クラス）。

`location` の物理型
-------------------
historical model（0032 / 0045 の `PointField(srid=4326)`）と実際の列型は
環境ごとに異なる: Production A2 実測 = `text`、NoGIS test lineage = `jsonb`、
GIS lineage = `geometry`。したがって

* 読み取りは `.only(...)` で `location` を常に除外する
  （bare `.filter()` は `GEOSException` を起こし得る。0091 / 0094 / 0098 /
  0099 / 0100 / 0101 と同じガード）
* PRE の NULL 判定は raw SQL の `location IS NULL` で行う。どの物理型でも成立する
* reverse は `location=None` だけを渡し、型付きリテラルを書かない

timestamp
---------
`psql` の表示文字列や session TimeZone に依存しないよう、PRE 定数は
**epoch microseconds** で保持し、比較も epoch microseconds で行う。
`datetime.timestamp()`（float）は 1.78e9 秒 + microsecond で仮数が不足し
得るため使わず、`timedelta` の整数除算で厳密に求める。

`Shrine.updated_at` は `auto_now=True` のため `save()` では PRE 値へ戻せない。
reverse は insert のあと `QuerySet.update()` で上書きする
（`update()` は `save()` を経由しないので `auto_now` が発火しない）。

signal
------
reverse の insert は `create()` ではなく `bulk_create()` で行う。
`temples.signals.fill_latlng_if_missing` / `auto_geocode_on_save` は
`pre_save` に接続されており、latitude / longitude が NULL の行を保存すると
35.0 / 135.0 という推測値を書き込む。PRE snapshot の実測値は両方 NULL で
あり、これを上書きされると reverse が成立しない。`bulk_create()` は
model signal を送出しないため PRE の NULL がそのまま保たれる。

sequence
--------
pk を明示して復元するだけで、`ALTER SEQUENCE ... RESTART` 等の巻き戻しは
一切行わない。
"""

from datetime import datetime, timedelta, timezone as dt_timezone

from django.db import migrations


# --------------------------------------------------------------------------
# Production PRE snapshot（正本）
# --------------------------------------------------------------------------

ARTIFACT_ID = 102

# `location` を除く 23 列。`location` は NULL であることを raw SQL で別途検証する。
SHRINE_PRE = {
    "kind": "shrine",
    "name_jp": "テスト確認神社 20260611",
    "name_romaji": None,
    "address": "東京テスト",
    "latitude": None,
    "longitude": None,
    "goriyaku": "",
    "sajin": "",
    "description": None,
    "element": None,
    "kyusei": None,
    "astro_elements": [],
    "visit_style_tags": [],
    "history_theme": "",
    "views_30d": 0,
    "favorites_30d": 0,
    "popular_score": 0.0,
    "last_popular_calc_at": None,
    "place_ref_id": None,
    "owner_id": 1,
}

# 2026-06-11T07:45:49.473076Z / 2026-06-11T07:45:49.473590Z
SHRINE_CREATED_AT_US = 1781163949473076
SHRINE_UPDATED_AT_US = 1781163949473590

# ORM から読む列（`location` を含めない）。
SHRINE_LOOKUP = ("id",) + tuple(SHRINE_PRE)

# 監査済み ShrineInteractionLog。exact に この 2 行だけが対象。
LOG_IDS = (3, 6)
LOG_PRE = {
    3: {
        "user_id": 1,
        "shrine_id": ARTIFACT_ID,
        "action_type": "detail_view",
        "source": "shrine_detail",
        "thread_id": None,
        "metadata": {"ctx": None, "event": "shrine_detail_view"},
        # 2026-06-11T07:51:37.018819Z
        "created_at_us": 1781164297018819,
    },
    6: {
        "user_id": 1,
        "shrine_id": ARTIFACT_ID,
        "action_type": "detail_view",
        "source": "shrine_detail",
        "thread_id": None,
        "metadata": {"ctx": None, "event": "shrine_detail_view"},
        # 2026-06-11T09:03:38.508071Z
        "created_at_us": 1781168618508071,
    },
}
LOG_SCALAR_FIELDS = ("user_id", "shrine_id", "action_type", "source", "thread_id", "metadata")
LOG_LOOKUP = ("id",) + LOG_SCALAR_FIELDS + ("created_at",)

# --------------------------------------------------------------------------
# Relation Gate
# --------------------------------------------------------------------------

# Django introspection 実測の被参照 relation から ShrineInteractionLog を
# 除いた 14 本。**この inventory は 11 へ縮小しない。** Production PRE 時点で
# DEPLOYED_ZERO=11 / NOT_DEPLOYED=3 だが、NOT_DEPLOYED は「今たまたま無い」
# だけであり契約上の母数は常に 14 である。
NON_INTERACTION_RELATIONS = (
    ("temples_shrinedeity", "shrine_id"),
    ("temples_shrinehistory", "shrine_id"),
    ("temples_historythemeassignment", "shrine_id"),
    ("temples_shrinegoriyakuassignment", "shrine_id"),
    ("temples_favorite", "shrine_id"),
    ("temples_conciergethread", "main_shrine_id"),
    ("temples_visit", "shrine_id"),
    ("temples_shrinereflection", "shrine_id"),
    ("temples_actionevent", "shrine_id"),
    ("temples_goshuin", "shrine_id"),
    ("temples_shrine_goriyaku_tags", "shrine_id"),
    # Production PRE 時点で NOT_DEPLOYED の 3 本。存在しないこと自体は許可し、
    # 存在する場合は必ず参照件数を実測する（0 件のみ継続、1 件以上で STOP）。
    ("temples_conciergehistory", "shrine_id"),
    ("temples_like", "shrine_id"),
    ("temples_rankinglog", "shrine_id"),
)
NON_INTERACTION_RELATION_TOTAL = 14

# ORM model を持たない legacy M2M。`Shrine._meta.related_objects` に現れない
# ため introspection inventory には入らず、独立 Gate として必ず確認する。
LEGACY_M2M_RELATION = ("temples_shrine_deities", "shrine_id")

INTERACTION_LOG_TABLE = "temples_shrineinteractionlog"
SHRINE_TABLE = "temples_shrine"

_EPOCH = datetime(1970, 1, 1, tzinfo=dt_timezone.utc)


class PreconditionViolation(Exception):
    """DB が承認済みの W0-B02-T02 PRE 状態と一致しないときに送出される。

    常に mutation の前に送出され、`Migration.atomic`（既定 `True`）により
    `RunPython` の transaction 全体が巻き戻る。0105 は適用済みにならない。
    """


def _err(detail):
    return PreconditionViolation(
        "[temples.0105 W0-B02-T02] PRESTATE_MISMATCH: "
        + detail
        + " — W0-B02-T02 は fail-closed / 可逆な、exact に監査された "
        "QA artefact の削除である。修復も推測も部分 cleanup も行わない。"
    )


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------


def _epoch_us(value):
    """aware/naive datetime を epoch microseconds（整数）へ厳密に変換する。

    `datetime.timestamp()` は float を返し 1.78e9 秒 + microsecond で
    仮数が不足し得るため使わない。
    """
    if value is None:
        return None
    if value.tzinfo is None:
        # USE_TZ=False 環境では naive が返る。Django は naive を UTC として扱う。
        value = value.replace(tzinfo=dt_timezone.utc)
    return (value - _EPOCH) // timedelta(microseconds=1)


def _dt(epoch_us):
    return _EPOCH + timedelta(microseconds=epoch_us)


def _table_exists(cur, table):
    cur.execute("SELECT to_regclass(%s) IS NOT NULL", [f"public.{table}"])
    return bool(cur.fetchone()[0])


def _column_exists(cur, table, column):
    """`table.column` が存在するときだけ True。

    環境によっては Shrine への FK を宣言する model の列が実在しない
    （例: GIS migration chain の `temples_conciergehistory.shrine_id`）。
    その relation は行を持ち得ないので NOT_DEPLOYED として扱う。
    """
    cur.execute(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_schema='public' AND table_name=%s AND column_name=%s",
        [table, column],
    )
    return cur.fetchone() is not None


def _count_refs(cur, table, column):
    cur.execute(f"SELECT COUNT(*) FROM {table} WHERE {column} = %s", [ARTIFACT_ID])
    return cur.fetchone()[0]


def _assert_relation_gate(cur):
    """14 relation + legacy M2M を fail-closed 検証する。

    NOT_DEPLOYED は許可するが黙って読み飛ばさず、必ず deployed 側を実測する。
    inventory は常に 14 本のまま扱う。
    """
    if len(NON_INTERACTION_RELATIONS) != NON_INTERACTION_RELATION_TOTAL:
        raise _err(
            f"relation inventory が {len(NON_INTERACTION_RELATIONS)} 本に変化している "
            f"(契約は常に {NON_INTERACTION_RELATION_TOTAL} 本) — inventory を縮小してはならない"
        )

    deployed_zero = 0
    not_deployed = 0
    for table, column in NON_INTERACTION_RELATIONS:
        if not _table_exists(cur, table) or not _column_exists(cur, table, column):
            not_deployed += 1
            continue
        n = _count_refs(cur, table, column)
        if n:
            raise _err(
                f"Shrine pk {ARTIFACT_ID} は {table}({column}) に想定外の "
                f"{n} 行から参照されている — W0-B02-T02 は relation data の移送・"
                "集約・再割当を一切行わない"
            )
        deployed_zero += 1

    if deployed_zero + not_deployed != NON_INTERACTION_RELATION_TOTAL:
        raise _err(
            f"relation gate の集計が合わない "
            f"(deployed_zero={deployed_zero}, not_deployed={not_deployed}, "
            f"total={NON_INTERACTION_RELATION_TOTAL})"
        )

    legacy_table, legacy_column = LEGACY_M2M_RELATION
    if _table_exists(cur, legacy_table) and _column_exists(cur, legacy_table, legacy_column):
        n = _count_refs(cur, legacy_table, legacy_column)
        if n:
            raise _err(
                f"Shrine pk {ARTIFACT_ID} は legacy M2M {legacy_table}({legacy_column}) に "
                f"{n} 行から参照されている"
            )


def _load_shrine(Shrine):
    return Shrine.objects.only(*SHRINE_LOOKUP).filter(pk=ARTIFACT_ID).first()


def _assert_shrine_matches_pre(cur, row):
    """23 列 + `location` + 2 つの timestamp を exact 比較する。

    SQL NULL と空文字を同一視しない（`is None` と `""` を別々に比較する）。
    """
    for field, expected in SHRINE_PRE.items():
        actual = getattr(row, field)
        if actual != expected or (actual is None) != (expected is None):
            raise _err(
                f"Shrine pk {ARTIFACT_ID} の {field} は {actual!r} "
                f"(期待値 {expected!r}) — reverse はこの静的値を復元する"
            )

    cur.execute(f"SELECT location IS NULL FROM {SHRINE_TABLE} WHERE id = %s", [ARTIFACT_ID])
    fetched = cur.fetchone()
    if fetched is None or not fetched[0]:
        raise _err(
            f"Shrine pk {ARTIFACT_ID} の location が NULL ではない "
            "(PRE snapshot は NULL。物理型は環境依存のため NULL 判定のみを行う)"
        )

    for field, expected_us in (
        ("created_at", SHRINE_CREATED_AT_US),
        ("updated_at", SHRINE_UPDATED_AT_US),
    ):
        actual_us = _epoch_us(getattr(row, field))
        if actual_us != expected_us:
            raise _err(
                f"Shrine pk {ARTIFACT_ID} の {field} は epoch_us={actual_us} "
                f"(期待値 {expected_us} = {_dt(expected_us).isoformat()}) — "
                "W0_B02_T02_UPDATED_AT_POLICY=EXACT_PRECONDITION_AND_REVERSE_VALUE により "
                "snapshot 後の書き込み / state drift は fail closed で STOP する"
            )


def _assert_logs_match_pre(InteractionLog):
    rows = list(
        InteractionLog.objects.only(*LOG_LOOKUP)
        .filter(shrine_id=ARTIFACT_ID)
        .order_by("id")
    )
    if len(rows) != len(LOG_IDS):
        raise _err(
            f"shrine_id={ARTIFACT_ID} の ShrineInteractionLog は {len(rows)} 行 "
            f"(期待値 {len(LOG_IDS)} 行、pk={list(LOG_IDS)}) — "
            "監査済みの 2 行以外が存在する状態では削除しない"
        )

    actual_ids = tuple(r.id for r in rows)
    if actual_ids != LOG_IDS:
        raise _err(
            f"shrine_id={ARTIFACT_ID} の ShrineInteractionLog の pk は {list(actual_ids)} "
            f"(期待値 {list(LOG_IDS)})"
        )

    for row in rows:
        expected = LOG_PRE[row.id]
        for field in LOG_SCALAR_FIELDS:
            actual = getattr(row, field)
            want = expected[field]
            if actual != want or (actual is None) != (want is None):
                raise _err(
                    f"ShrineInteractionLog pk {row.id} の {field} は {actual!r} "
                    f"(期待値 {want!r})"
                )
        actual_us = _epoch_us(row.created_at)
        if actual_us != expected["created_at_us"]:
            raise _err(
                f"ShrineInteractionLog pk {row.id} の created_at は "
                f"epoch_us={actual_us} (期待値 {expected['created_at_us']} = "
                f"{_dt(expected['created_at_us']).isoformat()})"
            )
    return rows


# --------------------------------------------------------------------------
# forward
# --------------------------------------------------------------------------


def remove_qa_artifact_forward(apps, schema_editor):
    Shrine = apps.get_model("temples", "Shrine")
    InteractionLog = apps.get_model("temples", "ShrineInteractionLog")

    with schema_editor.connection.cursor() as cur:
        row = _load_shrine(Shrine)

        if row is None:
            # pk 102 は Production にしか存在しない。fresh / 非 Production の
            # lineage では最初から不在であり、そこでは何もすることがない。
            # ただし「本当に fresh」と「artefact だけ外部で消された途中状態」は
            # 区別する: 監査済み log がまだ残っていれば後者であり fail closed。
            orphan_logs = InteractionLog.objects.filter(shrine_id=ARTIFACT_ID).count()
            if orphan_logs:
                raise _err(
                    f"Shrine pk {ARTIFACT_ID} は不在だが shrine_id={ARTIFACT_ID} の "
                    f"ShrineInteractionLog が {orphan_logs} 行残っている — "
                    "部分的に手を入れられた状態であり、fresh lineage と区別できない"
                )
            return  # fresh lineage: clean no-op

        _assert_shrine_matches_pre(cur, row)
        _assert_logs_match_pre(InteractionLog)
        _assert_relation_gate(cur)

        # --- ここから mutation。PRE はすべて検証済み。 ---

        # 監査済み log を pk で明示削除する。blind CASCADE に任せない。
        deleted_logs, _ = InteractionLog.objects.filter(
            pk__in=LOG_IDS, shrine_id=ARTIFACT_ID
        ).delete()
        if deleted_logs != len(LOG_IDS):
            raise _err(
                f"ShrineInteractionLog の削除件数が {deleted_logs} 行 "
                f"(期待値 {len(LOG_IDS)} 行)"
            )

        # Shrine 本体。PRE で全 relation の参照 0 件を証明済みなので Python 側の
        # cascade collector は不要。raw DELETE なら、想定外の子行が残っていた
        # 場合に黙って cascade せず FK violation で落ちる（fail closed）。
        cur.execute(f"DELETE FROM {SHRINE_TABLE} WHERE id = %s", [ARTIFACT_ID])
        if cur.rowcount != 1:
            raise _err(
                f"Shrine pk {ARTIFACT_ID} の削除件数が {cur.rowcount} 行 (期待値 1 行)"
            )


# --------------------------------------------------------------------------
# reverse
# --------------------------------------------------------------------------


def restore_qa_artifact_reverse(apps, schema_editor):
    Shrine = apps.get_model("temples", "Shrine")
    InteractionLog = apps.get_model("temples", "ShrineInteractionLog")

    if _load_shrine(Shrine) is not None:
        raise _err(
            f"Shrine pk {ARTIFACT_ID} が既に存在する — reverse は既存行を上書きしない"
        )

    clashing = list(
        InteractionLog.objects.filter(pk__in=LOG_IDS).values_list("id", flat=True)
    )
    if clashing:
        raise _err(
            f"ShrineInteractionLog pk {sorted(clashing)} が既に存在する — "
            "reverse は pk を再利用した別の行を上書きしない"
        )

    orphan = InteractionLog.objects.filter(shrine_id=ARTIFACT_ID).count()
    if orphan:
        raise _err(
            f"shrine_id={ARTIFACT_ID} の ShrineInteractionLog が {orphan} 行残っている "
            "— 想定外の状態であり復元しない"
        )

    # `location` は型付きリテラルを書かず None だけを渡す（物理型は環境依存）。
    #
    # `create()` ではなく `bulk_create()` を使う。`temples.signals` の
    # `fill_latlng_if_missing` / `auto_geocode_on_save` は `pre_save` に
    # 接続されており、latitude / longitude が NULL の行を保存すると
    # 35.0 / 135.0 を書き込んでしまう。PRE snapshot の実測値は両方 NULL で
    # あり、推測値で上書きされては reverse が成立しない。
    # `bulk_create()` は model signal を送出しないため、PRE の NULL が
    # そのまま保たれる（field レベルの `auto_now` は適用されるので、
    # timestamp は下の `update()` で PRE 値へ戻す）。
    Shrine.objects.bulk_create(
        [Shrine(id=ARTIFACT_ID, location=None, **SHRINE_PRE)]
    )
    # `updated_at` は auto_now のため insert では PRE 値にならない。
    # `QuerySet.update()` は save() を経由しないので auto_now が発火しない。
    Shrine.objects.filter(pk=ARTIFACT_ID).update(
        created_at=_dt(SHRINE_CREATED_AT_US),
        updated_at=_dt(SHRINE_UPDATED_AT_US),
    )

    InteractionLog.objects.bulk_create(
        [
            InteractionLog(
                id=log_id,
                **{field: LOG_PRE[log_id][field] for field in LOG_SCALAR_FIELDS},
            )
            for log_id in LOG_IDS
        ]
    )
    for log_id in LOG_IDS:
        InteractionLog.objects.filter(pk=log_id).update(
            created_at=_dt(LOG_PRE[log_id]["created_at_us"])
        )

    # sequence は巻き戻さない（pk を明示指定するだけ）。


class Migration(migrations.Migration):

    dependencies = [
        ("temples", "0104_evidence_link_foundation"),
    ]

    operations = [
        migrations.RunPython(remove_qa_artifact_forward, restore_qa_artifact_reverse),
    ]
