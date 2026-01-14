import pytest
from django.core.management import call_command
from temples.models import Shrine
from temples.management.commands.backfill_astro_elements import normalize_elements_to_ja

@pytest.mark.django_db
def test_backfill_astro_elements_force_repairs_only():
    s_valid = Shrine.objects.create(name_jp="Valid", astro_elements=["土"], popular_score=0.0)
    s_en = Shrine.objects.create(name_jp="English", astro_elements=["fire"], popular_score=0.0)
    s_old = Shrine.objects.create(name_jp="Old", astro_elements=["地"], popular_score=0.0)

    call_command("backfill_astro_elements", "--force", "--mode", "popular", "--seed", "42")

    s_valid.refresh_from_db()
    s_en.refresh_from_db()
    s_old.refresh_from_db()

    assert s_valid.astro_elements == ["土"]
    assert s_en.astro_elements == ["火"]
    assert s_old.astro_elements == ["土"]


@pytest.mark.parametrize(
    "src, expected",
    [
        (["fire"], ["火"]),
        (["water"], ["水"]),
        (["earth"], ["土"]),
        (["air"], ["風"]),
        (["地"], ["土"]),
    ],
)
def test_normalize_elements_to_ja_maps_en_and_old_to_ja(src, expected):
    assert normalize_elements_to_ja(src) == expected
