"""start.sh contract for the Visit Style Production audit / sync / rollback gates.

All three are opt-in, mutually exclusive, and fail closed: a misconfiguration
must `exit 1` *before* migrations, repairs or bootstrap get a chance to write.
"""

from pathlib import Path


START_SH = Path(__file__).resolve().parents[2] / "start.sh"

# Flags that can write to the DB during startup.
WRITE_CAPABLE_FLAGS = (
    "RUN_MIGRATIONS_ON_START",
    "RUN_SHRINE_REFLECTION_REPAIR",
    "RUN_FAVORITE_REPAIR_ON_START",
    "RUN_FEATUREUSAGE_REPAIR_ON_START",
    "RUN_BOOTSTRAP_ON_START",
)

REPAIR_FLAGS = (
    "RUN_SHRINE_REFLECTION_REPAIR",
    "RUN_FAVORITE_REPAIR_ON_START",
    "RUN_FEATUREUSAGE_REPAIR_ON_START",
)

AUDIT_FLAG = "RUN_VISIT_STYLE_AUDIT_ON_START"
SYNC_FLAG = "RUN_VISIT_STYLE_SYNC_ON_START"
ROLLBACK_FLAG = "RUN_VISIT_STYLE_ROLLBACK_ON_START"

SYNC_REQUIRED_ENV = (
    "VISIT_STYLE_SYNC_EXPECTED_UPDATES",
    "VISIT_STYLE_SYNC_EXPECTED_SEED_SHA256",
    "VISIT_STYLE_SYNC_EXPECTED_SNAPSHOT_SHA256",
)

ROLLBACK_REQUIRED_ENV = (
    "VISIT_STYLE_ROLLBACK_SNAPSHOT",
    "VISIT_STYLE_ROLLBACK_EXPECTED_SNAPSHOT_SHA256",
)


def _start_sh() -> str:
    return START_SH.read_text(encoding="utf-8")


def _gate_open(flag: str) -> str:
    return f'if [ "${{{flag}:-0}}" = "1" ]; then'


def _block(script: str, flag: str, end_marker: str) -> str:
    start = script.index(_gate_open(flag))
    return script[start : script.index(end_marker, start)]


def _audit_block(script: str) -> str:
    return _block(script, AUDIT_FLAG, "Visit style Production dry-run audit completed.")


def _sync_block(script: str) -> str:
    return _block(script, SYNC_FLAG, "Visit style Production sync completed.")


def _rollback_block(script: str) -> str:
    return _block(script, ROLLBACK_FLAG, "Visit style Production rollback completed.")


# --------------------------------------------------------------------------- #
# default-off contracts
# --------------------------------------------------------------------------- #


def test_every_visit_style_gate_defaults_to_off():
    script = _start_sh()

    for flag in (AUDIT_FLAG, SYNC_FLAG, ROLLBACK_FLAG):
        # `:-0` is what makes an unset variable a no-op instead of a run.
        assert _gate_open(flag) in script
        assert 'echo "Skipping Visit Style Production' in script


def test_visit_style_production_audit_uses_seed_import_dry_run_only():
    script = _start_sh()

    assert _gate_open(AUDIT_FLAG) in script
    assert script.count("python manage.py import_shrines_seed --dry-run") == 1
    assert "Visit style Production dry-run audit completed." in script


def test_sync_gate_exists_and_invokes_the_visit_style_only_command():
    script = _start_sh()
    block = _sync_block(script)

    assert "python manage.py sync_visit_style_tags_from_seed" in block
    # It must NOT reach for the full-payload importer.
    assert "import_shrines_seed" not in block


def test_rollback_gate_exists_and_invokes_the_snapshot_restore_command():
    script = _start_sh()
    block = _rollback_block(script)

    assert "python manage.py restore_visit_style_tags_snapshot" in block
    assert "import_shrines_seed" not in block


def test_sync_command_is_invoked_with_apply_and_all_three_locks():
    script = _start_sh()
    block = _sync_block(script)

    assert "--apply" in block
    assert '--expected-updates "${VISIT_STYLE_SYNC_EXPECTED_UPDATES}"' in block
    assert '--expected-seed-sha256 "${VISIT_STYLE_SYNC_EXPECTED_SEED_SHA256}"' in block
    assert (
        '--expected-snapshot-sha256 "${VISIT_STYLE_SYNC_EXPECTED_SNAPSHOT_SHA256}"'
        in block
    )


def test_rollback_command_is_invoked_with_apply_and_the_expected_hash():
    script = _start_sh()
    block = _rollback_block(script)

    assert "--apply" in block
    assert '--snapshot "${VISIT_STYLE_ROLLBACK_SNAPSHOT}"' in block
    assert (
        '--expected-snapshot-sha256 "${VISIT_STYLE_ROLLBACK_EXPECTED_SNAPSHOT_SHA256}"'
        in block
    )


# --------------------------------------------------------------------------- #
# mutual exclusion
# --------------------------------------------------------------------------- #


def test_audit_rejects_every_write_capable_startup_flag():
    block = _audit_block(_start_sh())

    for flag in WRITE_CAPABLE_FLAGS:
        assert f"${{{flag}:-0}}" in block

    assert (
        "ERROR: RUN_VISIT_STYLE_AUDIT_ON_START requires all write-capable startup flags to be disabled."
        in block
    )
    assert "exit 1" in block


def test_audit_rejects_sync_and_rollback():
    block = _audit_block(_start_sh())

    assert f"${{{SYNC_FLAG}:-0}}" in block
    assert f"${{{ROLLBACK_FLAG}:-0}}" in block


def test_sync_rejects_audit_rollback_migrations_repairs_and_bootstrap():
    block = _sync_block(_start_sh())

    for flag in (AUDIT_FLAG, ROLLBACK_FLAG, "RUN_MIGRATIONS_ON_START", "RUN_BOOTSTRAP_ON_START"):
        assert f"${{{flag}:-0}}" in block
    for flag in REPAIR_FLAGS:
        assert f"${{{flag}:-0}}" in block

    assert "ERROR: RUN_VISIT_STYLE_SYNC_ON_START requires" in block
    assert "exit 1" in block


def test_rollback_rejects_audit_sync_migrations_repairs_and_bootstrap():
    block = _rollback_block(_start_sh())

    for flag in (AUDIT_FLAG, SYNC_FLAG, "RUN_MIGRATIONS_ON_START", "RUN_BOOTSTRAP_ON_START"):
        assert f"${{{flag}:-0}}" in block
    for flag in REPAIR_FLAGS:
        assert f"${{{flag}:-0}}" in block

    assert "ERROR: RUN_VISIT_STYLE_ROLLBACK_ON_START requires" in block
    assert "exit 1" in block


# --------------------------------------------------------------------------- #
# required env
# --------------------------------------------------------------------------- #


def test_sync_exits_when_any_expected_env_is_empty():
    block = _sync_block(_start_sh())

    for name in SYNC_REQUIRED_ENV:
        assert f'[ -z "${{{name}:-}}" ]' in block

    assert (
        "ERROR: RUN_VISIT_STYLE_SYNC_ON_START requires "
        "VISIT_STYLE_SYNC_EXPECTED_UPDATES, VISIT_STYLE_SYNC_EXPECTED_SEED_SHA256 "
        "and VISIT_STYLE_SYNC_EXPECTED_SNAPSHOT_SHA256." in block
    )


def test_rollback_exits_when_any_expected_env_is_empty():
    block = _rollback_block(_start_sh())

    for name in ROLLBACK_REQUIRED_ENV:
        assert f'[ -z "${{{name}:-}}" ]' in block

    assert (
        "ERROR: RUN_VISIT_STYLE_ROLLBACK_ON_START requires "
        "VISIT_STYLE_ROLLBACK_SNAPSHOT and "
        "VISIT_STYLE_ROLLBACK_EXPECTED_SNAPSHOT_SHA256." in block
    )


# --------------------------------------------------------------------------- #
# ordering: operational blocks fail closed first
# --------------------------------------------------------------------------- #


def test_visit_style_production_audit_runs_before_write_capable_startup_blocks():
    script = _start_sh()
    audit_position = script.index(_gate_open(AUDIT_FLAG))

    for flag in WRITE_CAPABLE_FLAGS:
        assert audit_position < script.index(_gate_open(flag))


def test_sync_and_rollback_blocks_run_before_migrations_repairs_and_bootstrap():
    script = _start_sh()
    sync_position = script.index(_gate_open(SYNC_FLAG))
    rollback_position = script.index(_gate_open(ROLLBACK_FLAG))

    for flag in WRITE_CAPABLE_FLAGS:
        write_position = script.index(_gate_open(flag))
        assert sync_position < write_position
        assert rollback_position < write_position


def test_operational_blocks_are_ordered_audit_then_sync_then_rollback():
    script = _start_sh()

    assert (
        script.index(_gate_open(AUDIT_FLAG))
        < script.index(_gate_open(SYNC_FLAG))
        < script.index(_gate_open(ROLLBACK_FLAG))
    )


def test_bootstrap_fallback_never_reintroduces_with_visit_style():
    # visit_style_tags is Seed-canonical; the inference path stays REPAIR_ONLY.
    assert "--with-visit-style" not in _start_sh()
