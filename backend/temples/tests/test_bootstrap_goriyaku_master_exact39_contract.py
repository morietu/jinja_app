# Pins the reproducibility contract confirmed by the Mother Ship Decision on
# the Production-compatible `GoriyakuTag` master:
#
#     current repository seed + current bootstrap implementation
#         -> exactly the canonical 39-row master, ids 1..39
#
# This is deliberately *not* a "does the expected list contain 39 names" test.
# The Recommendation runtime addresses ご利益 by numeric `GoriyakuTag.id`
# (`temples.domain.need_to_goriyaku_tag_ids.NEED_TO_GORIYAKU_IDS`, pinned by
# `test_need_to_goriyaku_tag_ids.py`), so the id->name assignment produced by a
# fresh Production bootstrap is itself a contract. The test therefore drives the
# real Production entrypoint — `bootstrap_production_data`, which runs
# `import_shrines_seed` and then `backfill_goriyaku_tags --force` — against the repository-controlled seed and asserts the resulting
# master row-for-row. Parsing `shrines_seed_clean.json` here and creating the 39
# rows directly would assert nothing about the bootstrap path and is exactly
# what this test must not do.
#
# A seed edit, a `parse_goriyaku` change, a reordering of `BOOTSTRAP_STEPS`, or
# a new/renamed ご利益 label surfaces here as an explicit diff instead of a
# silent id shift that would silently re-point every Need mapping.
from io import StringIO

import pytest
from django.conf import settings
from django.core.management import call_command
from django.core.management.color import no_style
from django.db import connection

from temples.management.commands import bootstrap_production_data as bootstrap_module
from temples.models import GoriyakuTag, ProductionDataBootstrapRun, Shrine

# The canonical Production master (docs/audit/goriyaku-mapping-master-
# integrity.md Section 4). Written out literally, and independently of the seed
# file and of the bootstrap code, so that the assertion has real content.
CANONICAL_MASTER: tuple[tuple[int, str], ...] = (
    (1, "縁結び"),
    (2, "厄除け"),
    (3, "交通安全"),
    (4, "商売繁盛"),
    (5, "五穀豊穣"),
    (6, "開運"),
    (7, "家内安全"),
    (8, "福徳"),
    (9, "学業成就"),
    (10, "合格祈願"),
    (11, "勝運"),
    (12, "仕事運"),
    (13, "航海安全"),
    (14, "海上安全"),
    (15, "武運長久"),
    (16, "安産"),
    (17, "八方除"),
    (18, "夫婦円満"),
    (19, "八難除"),
    (20, "恋愛成就"),
    (21, "導き"),
    (22, "美容"),
    (23, "方除け"),
    (24, "健康長寿"),
    (25, "芸能"),
    (26, "家庭円満"),
    (27, "出世運"),
    (28, "金運"),
    (29, "芸能運"),
    (30, "強運厄除け"),
    (31, "技芸上達"),
    (32, "八方除け"),
    (33, "病気平癒"),
    (34, "火防"),
    (35, "子宝"),
    (36, "心願成就"),
    (37, "延命長寿"),
    (38, "足腰健康"),
    (39, "農業守護"),
)

CANONICAL_IDS = {row[0] for row in CANONICAL_MASTER}
CANONICAL_NAMES = {row[1] for row in CANONICAL_MASTER}

# Labels carried by the drifted developer-local `jinja_db` (46 rows) but absent
# from the Production master — see `0097_p5_id21_id22_tag_reconciliation`. A
# fresh bootstrap must never produce them.
KNOWN_LEGACY_LABELS = ("地域安泰", "地域守護", "rest_healing")

# The tables a fresh Production bootstrap starts from empty. Order matters:
# `Shrine` first so its `goriyaku_tags` M2M rows are cascaded away before the
# tags themselves are removed.
BOOTSTRAP_OWNED_MODELS = (Shrine, GoriyakuTag, ProductionDataBootstrapRun)


def _assert_connected_to_test_database() -> None:
    """Fail closed unless this connection is the test-runner-created database.

    The developer's local `jinja_db` (and Production) must never be touched by
    `_reset_to_fresh_bootstrap_state()`. Django points `connection` at the test
    database for the duration of the run, so the name is the authoritative
    check.
    """
    name = str(connection.settings_dict.get("NAME") or "")
    configured_test_name = str((connection.settings_dict.get("TEST") or {}).get("NAME") or "")

    assert name.startswith("test_"), (
        f"refusing to reset a non-test database: NAME={name!r}. This test only "
        f"ever operates on the database created by the test runner."
    )
    if configured_test_name:
        assert name == configured_test_name, (
            f"connected database {name!r} is not the configured test database "
            f"{configured_test_name!r}"
        )


def _reset_to_fresh_bootstrap_state() -> None:
    """Bring the *test* database to the state a fresh Production DB is in.

    Migrations (`temples.migrations` and the CI `temples.migrations_nogis`
    variant) create no `GoriyakuTag` row, so a freshly migrated database already
    has an empty master. What is not guaranteed is the *sequence* position and
    the absence of rows written by conftest autouse fixtures
    (`_ensure_shrine_exists` creates `Shrine` pk=1) or by whichever test ran
    before this one in the same session. Since the produced ids are the contract,
    both the rows and the id sequences have to start where Production started.
    """
    _assert_connected_to_test_database()

    for model in BOOTSTRAP_OWNED_MODELS:
        if model is Shrine:
            # Avoid Django deletion collector: ConciergeHistory model relation remains while the DB shrine_id column was removed by migration 0047.
            Shrine.goriyaku_tags.through.objects.all().delete()
            table = connection.ops.quote_name(Shrine._meta.db_table)
            with connection.cursor() as cursor:
                cursor.execute(f"DELETE FROM {table}")
        else:
            model.objects.all().delete()

    reset_sql = connection.ops.sequence_reset_by_name_sql(
        no_style(),
        [{"table": model._meta.db_table, "column": "id"} for model in BOOTSTRAP_OWNED_MODELS],
    )
    if reset_sql:
        with connection.cursor() as cursor:
            for statement in reset_sql:
                cursor.execute(statement)

    assert GoriyakuTag.objects.count() == 0
    assert Shrine.objects.count() == 0
    assert ProductionDataBootstrapRun.objects.count() == 0


def _run_production_bootstrap(monkeypatch) -> str:
    """Run the Production entrypoint itself, unmodified.

    `bootstrap_production_data` is idempotent through `ProductionDataBootstrapRun`
    markers, which `_reset_to_fresh_bootstrap_state()` has just cleared — so the
    fresh path really is exercised and there is no need to fall back to calling
    `import_shrines_seed` / `backfill_goriyaku_tags` by hand.

    `import_shrines_seed` defaults `--source` to the *relative* path
    `temples/data/shrines_seed_clean.json`, so it resolves against the working
    directory. Production runs `python manage.py bootstrap_production_data` from
    `backend/` (`backend/start.sh`, `RUN_BOOTSTRAP_ON_START=1`), i.e. from
    `settings.BASE_DIR`; CI happens to run pytest from there too, but a developer
    running pytest from the repository root does not. Reproducing the Production
    working directory keeps the default seed resolution itself inside the
    contract — passing an explicit `--source` would quietly step around it.

    `--skip-debug-counts` only suppresses the trailing summary print; it does not
    change any bootstrap step.
    """
    monkeypatch.chdir(settings.BASE_DIR)
    out = StringIO()
    call_command("bootstrap_production_data", "--skip-debug-counts", stdout=out, stderr=out)
    return out.getvalue()


def _master_rows() -> list[tuple[int, str]]:
    return list(GoriyakuTag.objects.order_by("id").values_list("id", "name"))


@pytest.mark.django_db(transaction=True, reset_sequences=True)
def test_fresh_bootstrap_produces_exact_canonical_39_row_master(monkeypatch):
    _reset_to_fresh_bootstrap_state()

    _run_production_bootstrap(monkeypatch)

    rows = _master_rows()

    # 1. count
    assert GoriyakuTag.objects.count() == 39
    # 2. ids are exactly 1..39, contiguous, no gaps and nothing outside
    assert {row[0] for row in rows} == CANONICAL_IDS
    assert [row[0] for row in rows] == list(range(1, 40))
    # 3. the full id -> name mapping, in id order
    assert rows == list(CANONICAL_MASTER)


@pytest.mark.django_db(transaction=True, reset_sequences=True)
def test_fresh_bootstrap_produces_no_extra_and_no_missing_labels(monkeypatch):
    _reset_to_fresh_bootstrap_state()

    _run_production_bootstrap(monkeypatch)

    produced = set(GoriyakuTag.objects.values_list("name", flat=True))

    # 4. no extra / legacy label
    assert produced - CANONICAL_NAMES == set()
    for legacy in KNOWN_LEGACY_LABELS:
        assert not GoriyakuTag.objects.filter(
            name=legacy
        ).exists(), f"legacy label {legacy!r} must not be produced by a fresh bootstrap"
    # 5. no canonical label missing
    assert CANONICAL_NAMES - produced == set()
    # names are unique, so name-set equality plus the count pins the master
    assert len(produced) == GoriyakuTag.objects.count() == 39


@pytest.mark.django_db(transaction=True, reset_sequences=True)
def test_fresh_bootstrap_runs_the_declared_production_steps_in_order(monkeypatch):
    # Guards the assumption the contract rests on: this test exercised the real
    # Production step list, in the Production order, with the Production args —
    # not a monkeypatched or partial path.
    assert [(step.step, step.command, step.args) for step in bootstrap_module.BOOTSTRAP_STEPS] == [
        ("import_shrines_seed", "import_shrines_seed", ()),
        (
            "backfill_goriyaku_tags",
            "backfill_goriyaku_tags",
            ("--force",),
        ),
    ]

    _reset_to_fresh_bootstrap_state()

    _run_production_bootstrap(monkeypatch)

    completed = list(
        ProductionDataBootstrapRun.objects.order_by("id").values_list("step", "status")
    )
    assert completed == [
        ("import_shrines_seed", ProductionDataBootstrapRun.Status.SUCCESS),
        ("backfill_goriyaku_tags", ProductionDataBootstrapRun.Status.SUCCESS),
    ]
    assert _master_rows() == list(CANONICAL_MASTER)


@pytest.mark.django_db(transaction=True, reset_sequences=True)
def test_repeated_bootstrap_keeps_the_master_byte_identical(monkeypatch):
    # Production re-runs the bootstrap entrypoint on every release; a second run
    # must neither append ids 40+ nor renumber anything.
    _reset_to_fresh_bootstrap_state()

    _run_production_bootstrap(monkeypatch)
    after_first = _master_rows()

    _run_production_bootstrap(monkeypatch)
    after_second = _master_rows()

    assert after_first == list(CANONICAL_MASTER)
    assert after_second == after_first
