from io import StringIO

import pytest
from django.core.management import call_command

from temples.models import Shrine


pytestmark = pytest.mark.django_db


def _make_shrine(name: str, address: str, visit_style_tags: list[str]) -> Shrine:
    return Shrine.objects.create(
        name_jp=name,
        address=address,
        goriyaku="開運",
        latitude=35.0,
        longitude=139.0,
        visit_style_tags=visit_style_tags,
    )


def test_normal_backfill_does_not_generate_visit_style_tags():
    shrine = _make_shrine("修復対象神社", "東京都千代田区1-1", [])

    call_command("backfill_goriyaku_tags", "--force", stdout=StringIO())

    shrine.refresh_from_db()
    assert shrine.visit_style_tags == []


def test_with_visit_style_repairs_empty_value_without_overwriting_existing_canonical_value():
    empty = _make_shrine("修復対象神社", "東京都千代田区1-2", [])
    canonical = _make_shrine("正本保持神社", "東京都千代田区1-3", ["classic"])

    call_command(
        "backfill_goriyaku_tags",
        "--with-visit-style",
        "--force",
        stdout=StringIO(),
    )

    empty.refresh_from_db()
    canonical.refresh_from_db()

    assert empty.visit_style_tags
    assert canonical.visit_style_tags == ["classic"]
