"""start.sh contract for the Visit Style Production audit / sync / rollback gates.

All three are opt-in, mutually exclusive, and fail closed: a *misconfiguration*
must `exit 1` *before* migrations, repairs or bootstrap get a chance to write.

The audit gate draws one further distinction, which the behavioural tests at the
bottom of this file exercise by actually running start.sh with stubbed
`python` / `gunicorn` binaries:

* a configuration conflict is still a hard `exit 1` -- the service must not boot
  into a state somebody mis-declared;
* a *command* failure of the read-only audit is logged and startup continues --
  a dry run that cannot answer its question is not a reason to take Production
  down.
"""

import os
import subprocess
from pathlib import Path

import pytest

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


# The audit gate's trailing `else` branch. Used as the audit block's end marker
# so the slice covers the failure branch too -- the completed message now sits
# in the middle of the block, not at its end.
AUDIT_END = 'echo "Skipping Visit Style Production audit.'
# Where the guard (config conflict) ends and the command invocation begins.
AUDIT_RUN_START = 'echo "Auditing Production visit_style_tags'
AUDIT_COMPLETED_LOG = "Visit style Production dry-run audit completed."
AUDIT_FAILED_LOG = "ERROR: Visit style Production dry-run audit failed"


def _audit_block(script: str) -> str:
    return _block(script, AUDIT_FLAG, AUDIT_END)


def _audit_guard_block(script: str) -> str:
    """Only the configuration-conflict guard: this part must `exit 1`."""
    return _block(script, AUDIT_FLAG, AUDIT_RUN_START)


def _audit_run_block(script: str) -> str:
    """Only the command invocation + result handling: this part must not exit."""
    start = script.index(AUDIT_RUN_START)
    return script[start : script.index(AUDIT_END, start)]


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


def test_visit_style_production_audit_uses_the_sync_command_default_dry_run():
    # The audit answers one question -- "how far is Production's
    # visit_style_tags from the canonical Base Seed?" -- so it runs the
    # Visit-Style-only sync command in its default (write-incapable) mode.
    script = _start_sh()
    block = _audit_block(script)

    assert _gate_open(AUDIT_FLAG) in script
    assert block.count("python manage.py sync_visit_style_tags_from_seed") == 1
    assert AUDIT_COMPLETED_LOG in script


def test_visit_style_production_audit_never_passes_apply_or_any_expected_lock():
    # Default dry run is what makes this gate read-only. `--apply` here would
    # turn an audit into a Production write.
    block = _audit_block(_start_sh())

    assert "--apply" not in block
    assert "--expected-" not in block


def test_visit_style_production_audit_does_not_use_the_full_payload_importer():
    # import_shrines_seed --dry-run reports goriyaku / latitude / longitude
    # drift too, which is not what this gate is asking about.
    block = _audit_block(_start_sh())

    assert "import_shrines_seed" not in block


def test_start_sh_no_longer_invokes_the_importer_dry_run_anywhere():
    assert "python manage.py import_shrines_seed --dry-run" not in _start_sh()


# --------------------------------------------------------------------------- #
# audit command failure must not take the service down
# --------------------------------------------------------------------------- #


def test_audit_command_is_invoked_inside_an_if_so_set_e_cannot_abort_startup():
    # `set -e` is suspended for the condition of an `if`, which is what lets a
    # non-zero audit exit fall through to the else branch instead of killing
    # the script.
    run_block = _audit_run_block(_start_sh())

    assert "if python manage.py sync_visit_style_tags_from_seed; then" in run_block
    assert "else" in run_block


def _code_lines(block: str) -> list[str]:
    """The block's shell statements, without comment-only lines."""
    return [
        stripped
        for stripped in (line.strip() for line in block.splitlines())
        if stripped and not stripped.startswith("#")
    ]


def test_audit_command_failure_branch_logs_an_error_and_does_not_exit():
    run_block = _audit_run_block(_start_sh())

    assert AUDIT_FAILED_LOG in run_block
    assert "exit=${visit_style_audit_exit}" in run_block
    # No statement in the invocation/result handling may terminate the script.
    for line in _code_lines(run_block):
        assert not line.startswith("exit"), f"audit run block must not exit: {line!r}"
        assert "exit 1" not in line


def test_audit_completed_log_is_emitted_only_on_success():
    run_block = _audit_run_block(_start_sh())

    completed_at = run_block.index(AUDIT_COMPLETED_LOG)
    else_at = run_block.index("else", completed_at)
    failed_at = run_block.index(AUDIT_FAILED_LOG)

    # completed -> else -> ERROR: the success message is unreachable on failure.
    assert completed_at < else_at < failed_at
    assert run_block.count(AUDIT_COMPLETED_LOG) == 1


def test_audit_configuration_conflict_is_still_a_hard_exit():
    # The failure tolerance above applies to the command only; a
    # misconfiguration still refuses to boot.
    guard_block = _audit_guard_block(_start_sh())

    assert "exit 1" in guard_block
    for flag in WRITE_CAPABLE_FLAGS + (SYNC_FLAG, ROLLBACK_FLAG):
        assert f"${{{flag}:-0}}" in guard_block


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


# --------------------------------------------------------------------------- #
# behavioural: actually run start.sh with stubbed python / gunicorn
# --------------------------------------------------------------------------- #

GUNICORN_MARKER = "STUB-GUNICORN-REACHED"

_PYTHON_STUB = """#!/usr/bin/env bash
# Stands in for the real interpreter so start.sh can be executed end to end.
# Only the audit invocation is interesting; everything else succeeds quietly.
if [ "$2" = "sync_visit_style_tags_from_seed" ]; then
  echo "STUB-AUDIT-INVOKED $*"
  exit {audit_exit}
fi
echo "STUB-PYTHON $*"
exit 0
"""

_GUNICORN_STUB = f"""#!/usr/bin/env bash
echo "{GUNICORN_MARKER}"
exit 0
"""


def _run_start_sh(tmp_path, *, audit_exit: int = 0, env: dict | None = None):
    """Run the real start.sh with stub binaries on PATH.

    `exec gunicorn` at the tail becomes the stub, so reaching GUNICORN_MARKER
    means "startup was not aborted".
    """
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir(exist_ok=True)
    (bin_dir / "python").write_text(_PYTHON_STUB.format(audit_exit=audit_exit))
    (bin_dir / "gunicorn").write_text(_GUNICORN_STUB)
    for name in ("python", "gunicorn"):
        (bin_dir / name).chmod(0o755)

    child_env = {
        "PATH": f"{bin_dir}:{os.environ.get('PATH', '')}",
        "HOME": str(tmp_path),
    }
    child_env.update(env or {})

    return subprocess.run(
        ["bash", str(START_SH)],
        cwd=str(tmp_path),
        env=child_env,
        capture_output=True,
        text=True,
        timeout=60,
    )


@pytest.fixture
def start_sh_runner(tmp_path):
    def _run(**kwargs):
        return _run_start_sh(tmp_path, **kwargs)

    return _run


def test_audit_success_completes_and_startup_continues(start_sh_runner):
    result = start_sh_runner(audit_exit=0, env={AUDIT_FLAG: "1"})

    assert result.returncode == 0
    assert "STUB-AUDIT-INVOKED" in result.stdout
    assert AUDIT_COMPLETED_LOG in result.stdout
    assert AUDIT_FAILED_LOG not in result.stdout
    assert GUNICORN_MARKER in result.stdout


def test_audit_command_failure_does_not_stop_startup(start_sh_runner):
    result = start_sh_runner(audit_exit=3, env={AUDIT_FLAG: "1"})

    assert result.returncode == 0, "a failed read-only audit must not abort startup"
    assert AUDIT_FAILED_LOG in result.stdout
    assert "exit=3" in result.stdout
    assert GUNICORN_MARKER in result.stdout


def test_audit_command_failure_does_not_emit_the_completed_log(start_sh_runner):
    result = start_sh_runner(audit_exit=3, env={AUDIT_FLAG: "1"})

    assert AUDIT_COMPLETED_LOG not in result.stdout


def test_audit_invocation_carries_no_apply_and_no_expected_lock(start_sh_runner):
    result = start_sh_runner(audit_exit=0, env={AUDIT_FLAG: "1"})

    invocation = next(
        line for line in result.stdout.splitlines() if line.startswith("STUB-AUDIT-INVOKED")
    )
    assert "--apply" not in invocation
    assert "--expected-" not in invocation
    assert invocation.endswith("manage.py sync_visit_style_tags_from_seed")


def test_audit_is_skipped_and_startup_continues_when_the_flag_is_unset(start_sh_runner):
    result = start_sh_runner(audit_exit=3, env={})

    assert result.returncode == 0
    assert "STUB-AUDIT-INVOKED" not in result.stdout
    assert "Skipping Visit Style Production audit." in result.stdout
    assert GUNICORN_MARKER in result.stdout


@pytest.mark.parametrize(
    "conflicting_flag",
    (
        SYNC_FLAG,
        ROLLBACK_FLAG,
        "RUN_MIGRATIONS_ON_START",
        "RUN_SHRINE_REFLECTION_REPAIR",
        "RUN_FAVORITE_REPAIR_ON_START",
        "RUN_FEATUREUSAGE_REPAIR_ON_START",
        "RUN_BOOTSTRAP_ON_START",
    ),
)
def test_audit_configuration_conflict_exits_one_before_anything_runs(
    start_sh_runner, conflicting_flag
):
    result = start_sh_runner(
        audit_exit=0, env={AUDIT_FLAG: "1", conflicting_flag: "1"}
    )

    assert result.returncode == 1
    assert (
        "ERROR: RUN_VISIT_STYLE_AUDIT_ON_START requires all write-capable startup "
        "flags to be disabled." in result.stdout
    )
    assert "STUB-AUDIT-INVOKED" not in result.stdout
    assert GUNICORN_MARKER not in result.stdout
