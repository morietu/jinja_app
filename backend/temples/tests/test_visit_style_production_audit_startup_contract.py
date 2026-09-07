from pathlib import Path


START_SH = Path(__file__).resolve().parents[2] / "start.sh"
WRITE_CAPABLE_FLAGS = (
    "RUN_MIGRATIONS_ON_START",
    "RUN_SHRINE_REFLECTION_REPAIR",
    "RUN_FAVORITE_REPAIR_ON_START",
    "RUN_FEATUREUSAGE_REPAIR_ON_START",
    "RUN_BOOTSTRAP_ON_START",
)


def _start_sh() -> str:
    return START_SH.read_text(encoding="utf-8")


def test_visit_style_production_audit_uses_seed_import_dry_run_only():
    script = _start_sh()

    assert 'if [ "${RUN_VISIT_STYLE_AUDIT_ON_START:-0}" = "1" ]; then' in script
    assert script.count("python manage.py import_shrines_seed --dry-run") == 1
    assert "Visit style Production dry-run audit completed." in script


def test_visit_style_production_audit_rejects_every_write_capable_startup_flag():
    script = _start_sh()
    audit_start = script.index(
        'if [ "${RUN_VISIT_STYLE_AUDIT_ON_START:-0}" = "1" ]; then'
    )
    audit_end = script.index(
        "Visit style Production dry-run audit completed.", audit_start
    )
    audit_block = script[audit_start:audit_end]

    for flag in WRITE_CAPABLE_FLAGS:
        assert f"${{{flag}:-0}}" in audit_block

    assert (
        "ERROR: RUN_VISIT_STYLE_AUDIT_ON_START requires all write-capable startup flags to be disabled."
        in audit_block
    )
    assert "exit 1" in audit_block


def test_visit_style_production_audit_runs_before_write_capable_startup_blocks():
    script = _start_sh()
    audit_position = script.index(
        'if [ "${RUN_VISIT_STYLE_AUDIT_ON_START:-0}" = "1" ]; then'
    )

    for flag in WRITE_CAPABLE_FLAGS:
        write_position = script.index(f'if [ "${{{flag}:-0}}" = "1" ]; then')
        assert audit_position < write_position
