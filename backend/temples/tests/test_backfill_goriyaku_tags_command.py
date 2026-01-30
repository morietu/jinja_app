import pytest
from django.core.management import call_command

from temples.models import GoriyakuTag, Shrine


@pytest.mark.django_db
def test_backfill_goriyaku_tags_creates_and_links():
    s = Shrine.objects.create(name_jp="T", goriyaku="縁結び・厄除け・交通安全")
    call_command("backfill_goriyaku_tags")
    names = sorted(list(s.goriyaku_tags.values_list("name", flat=True)))
    assert names == ["交通安全", "厄除け", "縁結び"]


@pytest.mark.django_db
def test_backfill_goriyaku_tags_is_idempotent():
    s = Shrine.objects.create(name_jp="T", goriyaku="縁結び・厄除け")
    call_command("backfill_goriyaku_tags")
    first = GoriyakuTag.objects.count()
    call_command("backfill_goriyaku_tags")
    second = GoriyakuTag.objects.count()
    assert first == second
    assert s.goriyaku_tags.count() == 2


@pytest.mark.django_db
def test_backfill_goriyaku_tags_force_adds_missing():
    tag = GoriyakuTag.objects.create(name="縁結び")
    s = Shrine.objects.create(name_jp="T", goriyaku="縁結び・厄除け")
    s.goriyaku_tags.add(tag)

    call_command("backfill_goriyaku_tags")  # forceなし: M2M empty じゃないので基本スキップ
    assert sorted(list(s.goriyaku_tags.values_list("name", flat=True))) == ["縁結び"]

    call_command("backfill_goriyaku_tags", "--force")
    assert sorted(list(s.goriyaku_tags.values_list("name", flat=True))) == ["厄除け", "縁結び"]
