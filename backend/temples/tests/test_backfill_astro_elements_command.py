# backend/temples/tests/test_backfill_astro_elements_command.py
import pytest
from django.core.management import call_command

from temples.models import Shrine


@pytest.mark.django_db
def test_backfill_astro_elements_dry_run_does_not_write_db(capsys):
    """
    目的:
      - --dry-run では astro_elements が DB に書き込まれないことを保証する
    """

    shrine = Shrine.objects.create(
        name_jp="DryRun Shrine",
        astro_elements=[],
        popular_score=0.0,
    )

    call_command("backfill_astro_elements", "--dry-run")

    shrine.refresh_from_db()

    # DB は変更されていない
    assert shrine.astro_elements == []

    # 出力はされている（= dry-run でも処理は走る）
    captured = capsys.readouterr().out
    assert "DryRun Shrine" in captured
    assert "Dry-run" in captured or "dry" in captured.lower()
