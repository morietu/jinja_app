# backend/temples/tests/test_migration_0105_w0b02t02_remove_qa_artifact_id102.py
"""Behavioral tests for temples.0105_w0b02t02_remove_qa_artifact_id102.

`docs/audit/shrine-expansion-wave0-b02-t02-remove-qa-artifact-id102.md`

fail-closed / 可逆。forward は Production PRE snapshot と exact に一致する
状態でだけ動き、そうでなければ `PreconditionViolation` を送出して
`RunPython` の transaction 全体を巻き戻す。

forward / reverse の callable を、小さな `apps` + `schema_editor` shim 経由で
実 model に対して直接実行する（0095-0101 の migration-test パターン。
GIS / nogis のどちらの lineage でも動く）。
"""

import importlib

import pytest
from django.db import connection

from temples.models import Shrine, ShrineInteractionLog

_mod = importlib.import_module(
    "temples.migrations.0105_w0b02t02_remove_qa_artifact_id102"
)
forward = _mod.remove_qa_artifact_forward
reverse = _mod.restore_qa_artifact_reverse
PreconditionViolation = _mod.PreconditionViolation

ID = _mod.ARTIFACT_ID
LOG_IDS = _mod.LOG_IDS
SHRINE_PRE = _mod.SHRINE_PRE
LOG_PRE = _mod.LOG_PRE
CREATED_US = _mod.SHRINE_CREATED_AT_US
UPDATED_US = _mod.SHRINE_UPDATED_AT_US
_dt = _mod._dt
_epoch_us = _mod._epoch_us


class _Apps:
    _models = {"Shrine": Shrine, "ShrineInteractionLog": ShrineInteractionLog}

    def get_model(self, app_label, model_name):
        assert app_label == "temples"
        return self._models[model_name]


class _SchemaEditor:
    connection = connection


APPS = _Apps()
SE = _SchemaEditor()


# --------------------------------------------------------------------------
# fixtures
# --------------------------------------------------------------------------


def _make_shrine(**over):
    """PRE state を作る。

    `Shrine.objects.create()` は `temples.signals` の `pre_save` を発火させ、
    latitude / longitude が NULL の行に 35.0 / 135.0 を書き込んでしまう。
    PRE の実測値は両方 NULL なので、signal を送出しない `bulk_create()` を使う
    （migration の reverse も同じ理由で `bulk_create()` を使っている）。
    """
    kw = dict(SHRINE_PRE)
    kw.update(over)
    Shrine.objects.bulk_create([Shrine(id=ID, location=None, **kw)])
    _set_times()
    return Shrine.objects.only("id").get(pk=ID)


def _set_times(created_us=CREATED_US, updated_us=UPDATED_US):
    Shrine.objects.filter(pk=ID).update(
        created_at=_dt(created_us), updated_at=_dt(updated_us)
    )


def _make_log(log_id, **over):
    spec = dict(LOG_PRE[log_id])
    created_us = over.pop("created_at_us", spec.pop("created_at_us"))
    spec.update(over)
    ShrineInteractionLog.objects.bulk_create([ShrineInteractionLog(id=log_id, **spec)])
    ShrineInteractionLog.objects.filter(pk=log_id).update(created_at=_dt(created_us))
    return ShrineInteractionLog.objects.get(pk=log_id)


@pytest.fixture
def full_pre(db, django_user_model):
    """Production PRE と exact に一致する状態を作る。"""
    django_user_model.objects.get_or_create(
        id=1, defaults={"username": "w0b02t02-operator"}
    )
    _make_shrine()
    for log_id in LOG_IDS:
        _make_log(log_id)
    return True


def _artifact_rows():
    return (
        Shrine.objects.filter(pk=ID).count(),
        ShrineInteractionLog.objects.filter(shrine_id=ID).count(),
    )


def _assert_nothing_deleted():
    assert _artifact_rows() == (1, len(LOG_IDS))


# --------------------------------------------------------------------------
# forward: happy path
# --------------------------------------------------------------------------


def test_forward_deletes_artifact_and_audited_logs_on_exact_pre(full_pre):
    forward(APPS, SE)
    assert _artifact_rows() == (0, 0)
    assert not ShrineInteractionLog.objects.filter(pk__in=LOG_IDS).exists()


def test_forward_is_a_clean_no_op_on_a_fresh_lineage(db):
    # pk 102 も log も存在しない lineage（Production 以外）では何もしない。
    assert _artifact_rows() == (0, 0)
    forward(APPS, SE)
    assert _artifact_rows() == (0, 0)


def test_forward_no_op_does_not_touch_other_shrines(db):
    """fresh lineage の no-op が他の行に影響しないこと。

    「artefact 不在 + 監査済み log 残存」という途中状態は、
    `temples_shrineinteractionlog.shrine_id` の FK により DB 上で成立しない
    （migration 側の orphan guard は、FK が失われた環境向けの防御として残す）。
    """
    other = Shrine.objects.create(name_jp="無関係神社", address="東京都新宿区1-1")
    forward(APPS, SE)
    assert Shrine.objects.filter(pk=other.id).exists()
    assert Shrine.objects.filter(pk=ID).count() == 0


# --------------------------------------------------------------------------
# forward: Shrine field drift
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "field,bad",
    [
        ("kind", "temple"),
        ("name_jp", "テスト確認神社 20260612"),
        ("address", "東京テスト "),
        ("views_30d", 1),
        ("owner_id", None),
    ],
)
def test_forward_stops_on_any_single_shrine_field_drift(full_pre, field, bad):
    Shrine.objects.filter(pk=ID).update(**{field: bad})
    _set_times()
    with pytest.raises(PreconditionViolation):
        forward(APPS, SE)
    _assert_nothing_deleted()


@pytest.mark.parametrize(
    "field,bad",
    [
        # NULL であるべき列が空文字 / 空文字であるべき列が NULL
        ("name_romaji", ""),
        ("description", ""),
        ("element", ""),
        ("kyusei", ""),
        ("goriyaku", None),
        ("sajin", None),
    ],
)
def test_forward_stops_on_null_versus_empty_string_drift(full_pre, field, bad):
    Shrine.objects.filter(pk=ID).update(**{field: bad})
    _set_times()
    with pytest.raises(PreconditionViolation):
        forward(APPS, SE)
    _assert_nothing_deleted()


def test_forward_stops_when_updated_at_drifts_by_one_microsecond(full_pre):
    _set_times(updated_us=UPDATED_US + 1)
    with pytest.raises(PreconditionViolation):
        forward(APPS, SE)
    _assert_nothing_deleted()


def test_forward_stops_when_created_at_drifts_by_one_microsecond(full_pre):
    _set_times(created_us=CREATED_US - 1)
    with pytest.raises(PreconditionViolation):
        forward(APPS, SE)
    _assert_nothing_deleted()


# --------------------------------------------------------------------------
# forward: InteractionLog drift
# --------------------------------------------------------------------------


def test_forward_stops_when_an_unexpected_interaction_log_is_added(full_pre):
    ShrineInteractionLog.objects.create(
        id=99, user_id=1, shrine_id=ID, action_type="detail_view",
        source="shrine_detail", metadata={},
    )
    with pytest.raises(PreconditionViolation):
        forward(APPS, SE)
    assert Shrine.objects.filter(pk=ID).count() == 1
    assert ShrineInteractionLog.objects.filter(shrine_id=ID).count() == 3


def test_forward_stops_when_log_pk_set_differs(full_pre):
    # 件数は 2 のままで pk だけ {3,6} から外す
    ShrineInteractionLog.objects.filter(pk=6).delete()
    ShrineInteractionLog.objects.create(
        id=7, user_id=1, shrine_id=ID, action_type="detail_view",
        source="shrine_detail", metadata=LOG_PRE[6]["metadata"],
    )
    with pytest.raises(PreconditionViolation):
        forward(APPS, SE)
    assert Shrine.objects.filter(pk=ID).count() == 1
    assert ShrineInteractionLog.objects.filter(shrine_id=ID).count() == 2


@pytest.mark.parametrize(
    "field,bad",
    [
        ("action_type", "route_open"),
        ("source", ""),
        ("metadata", {"ctx": None, "event": "other"}),
    ],
)
def test_forward_stops_on_interaction_log_field_drift(full_pre, django_user_model, field, bad):
    ShrineInteractionLog.objects.filter(pk=3).update(**{field: bad})
    with pytest.raises(PreconditionViolation):
        forward(APPS, SE)
    _assert_nothing_deleted()


def test_forward_stops_when_a_log_thread_id_is_no_longer_null(full_pre):
    """PRE の thread_id は SQL NULL。実在 thread が紐付いていれば STOP。"""
    from temples.models import ConciergeThread

    thread = ConciergeThread.objects.create(user_id=1)
    ShrineInteractionLog.objects.filter(pk=3).update(thread_id=thread.id)
    with pytest.raises(PreconditionViolation):
        forward(APPS, SE)
    _assert_nothing_deleted()


def test_forward_stops_on_interaction_log_created_at_drift(full_pre):
    ShrineInteractionLog.objects.filter(pk=3).update(
        created_at=_dt(LOG_PRE[3]["created_at_us"] + 1)
    )
    with pytest.raises(PreconditionViolation):
        forward(APPS, SE)
    _assert_nothing_deleted()


# --------------------------------------------------------------------------
# forward: Relation Gate
# --------------------------------------------------------------------------


def test_forward_stops_when_a_deployed_relation_references_the_artifact(full_pre):
    from temples.models import Favorite

    Favorite.objects.create(shrine_id=ID, user_id=1)
    with pytest.raises(PreconditionViolation):
        forward(APPS, SE)
    _assert_nothing_deleted()


def _drop_table(table):
    with connection.cursor() as cur:
        cur.execute(f"DROP TABLE IF EXISTS {table} CASCADE")


def _create_ref_table(table):
    with connection.cursor() as cur:
        cur.execute(
            f"CREATE TABLE IF NOT EXISTS {table} "
            "(id serial PRIMARY KEY, shrine_id integer)"
        )


def _insert_ref(table, shrine_id=ID):
    with connection.cursor() as cur:
        cur.execute(f"INSERT INTO {table} (shrine_id) VALUES (%s)", [shrine_id])


def test_forward_passes_when_a_formerly_not_deployed_table_exists_with_zero_rows(full_pre):
    # Production PRE では NOT_DEPLOYED。存在するようになっていても 0 件なら継続。
    _drop_table("temples_like")
    _create_ref_table("temples_like")
    try:
        forward(APPS, SE)
        assert _artifact_rows() == (0, 0)
    finally:
        _drop_table("temples_like")


def test_forward_stops_when_a_formerly_not_deployed_table_has_a_reference(full_pre):
    _drop_table("temples_rankinglog")
    _create_ref_table("temples_rankinglog")
    _insert_ref("temples_rankinglog")
    try:
        with pytest.raises(PreconditionViolation):
            forward(APPS, SE)
        _assert_nothing_deleted()
    finally:
        _drop_table("temples_rankinglog")


def test_forward_passes_when_legacy_m2m_table_is_absent_or_empty(full_pre):
    _drop_table("temples_shrine_deities")
    _create_ref_table("temples_shrine_deities")
    try:
        forward(APPS, SE)
        assert _artifact_rows() == (0, 0)
    finally:
        _drop_table("temples_shrine_deities")


def test_forward_stops_when_legacy_m2m_references_the_artifact(full_pre):
    _drop_table("temples_shrine_deities")
    _create_ref_table("temples_shrine_deities")
    _insert_ref("temples_shrine_deities")
    try:
        with pytest.raises(PreconditionViolation):
            forward(APPS, SE)
        _assert_nothing_deleted()
    finally:
        _drop_table("temples_shrine_deities")


def test_relation_inventory_stays_at_fourteen():
    assert len(_mod.NON_INTERACTION_RELATIONS) == 14
    assert _mod.NON_INTERACTION_RELATION_TOTAL == 14
    tables = [t for t, _ in _mod.NON_INTERACTION_RELATIONS]
    assert "temples_shrineinteractionlog" not in tables
    for formerly_not_deployed in (
        "temples_conciergehistory",
        "temples_like",
        "temples_rankinglog",
    ):
        assert formerly_not_deployed in tables


# --------------------------------------------------------------------------
# reverse
# --------------------------------------------------------------------------


def test_reverse_restores_the_shrine_with_every_field_exact(full_pre):
    forward(APPS, SE)
    reverse(APPS, SE)

    row = Shrine.objects.only(*_mod.SHRINE_LOOKUP).get(pk=ID)
    for field, expected in SHRINE_PRE.items():
        actual = getattr(row, field)
        assert actual == expected, field
        assert (actual is None) == (expected is None), field

    with connection.cursor() as cur:
        cur.execute("SELECT location IS NULL FROM temples_shrine WHERE id = %s", [ID])
        assert cur.fetchone()[0] is True


def test_reverse_restores_both_interaction_logs_with_every_field_exact(full_pre):
    forward(APPS, SE)
    reverse(APPS, SE)

    rows = list(
        ShrineInteractionLog.objects.filter(shrine_id=ID).order_by("id")
    )
    assert [r.id for r in rows] == list(LOG_IDS)
    for row in rows:
        spec = LOG_PRE[row.id]
        for field in _mod.LOG_SCALAR_FIELDS:
            assert getattr(row, field) == spec[field], (row.id, field)


def test_reverse_restores_timestamps_to_the_exact_microsecond(full_pre):
    forward(APPS, SE)
    reverse(APPS, SE)

    row = Shrine.objects.only("id", "created_at", "updated_at").get(pk=ID)
    assert _epoch_us(row.created_at) == CREATED_US
    assert _epoch_us(row.updated_at) == UPDATED_US

    for log_id in LOG_IDS:
        log = ShrineInteractionLog.objects.get(pk=log_id)
        assert _epoch_us(log.created_at) == LOG_PRE[log_id]["created_at_us"]


def test_forward_then_reverse_round_trips_to_the_pre_state(full_pre):
    before = (
        Shrine.objects.only(*_mod.SHRINE_LOOKUP).get(pk=ID),
        list(ShrineInteractionLog.objects.filter(shrine_id=ID).order_by("id")),
    )
    before_snapshot = (
        {f: getattr(before[0], f) for f in SHRINE_PRE},
        _epoch_us(before[0].created_at),
        _epoch_us(before[0].updated_at),
        [(r.id, r.action_type, r.source, r.thread_id, r.metadata, _epoch_us(r.created_at)) for r in before[1]],
    )

    forward(APPS, SE)
    reverse(APPS, SE)

    after_row = Shrine.objects.only(*_mod.SHRINE_LOOKUP).get(pk=ID)
    after_logs = list(ShrineInteractionLog.objects.filter(shrine_id=ID).order_by("id"))
    after_snapshot = (
        {f: getattr(after_row, f) for f in SHRINE_PRE},
        _epoch_us(after_row.created_at),
        _epoch_us(after_row.updated_at),
        [(r.id, r.action_type, r.source, r.thread_id, r.metadata, _epoch_us(r.created_at)) for r in after_logs],
    )
    assert after_snapshot == before_snapshot

    # 復元後は forward が再び成立する（PRE と exact 一致している証明）。
    forward(APPS, SE)
    assert _artifact_rows() == (0, 0)


def test_reverse_stops_when_the_shrine_pk_is_reused(full_pre):
    forward(APPS, SE)
    Shrine.objects.create(id=ID, name_jp="別の実在神社", address="東京都千代田区1-1")
    with pytest.raises(PreconditionViolation):
        reverse(APPS, SE)
    assert Shrine.objects.get(pk=ID).name_jp == "別の実在神社"
    assert not ShrineInteractionLog.objects.filter(pk__in=LOG_IDS).exists()


def test_reverse_stops_when_an_interaction_log_pk_is_reused(full_pre):
    forward(APPS, SE)
    other = Shrine.objects.create(name_jp="別神社", address="東京都港区1-1")
    ShrineInteractionLog.objects.create(
        id=3, user_id=1, shrine_id=other.id, action_type="detail_view",
        source="shrine_detail", metadata={},
    )
    with pytest.raises(PreconditionViolation):
        reverse(APPS, SE)
    assert Shrine.objects.filter(pk=ID).count() == 0
    assert ShrineInteractionLog.objects.get(pk=3).shrine_id == other.id


def test_reverse_does_not_rewind_the_sequence(full_pre):
    """pk を明示復元するだけで sequence は巻き戻さない。

    forward -> reverse のあとに新規作成した Shrine の pk が、reverse 前に
    採番されていた最大 pk より大きいままであることを確認する。
    """
    probe = Shrine.objects.create(name_jp="採番プローブ", address="東京都中央区1-1")
    high_water = probe.id

    forward(APPS, SE)
    reverse(APPS, SE)

    after = Shrine.objects.create(name_jp="採番プローブ2", address="東京都中央区1-2")
    assert after.id > high_water
