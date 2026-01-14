import pytest
from django.core.management import call_command

from temples.models import Shrine


@pytest.mark.django_db
def test_backfill_astro_elements_writes_ja_elements():
    Shrine.objects.create(name_jp="A", astro_elements=[], popular_score=0.0)
    Shrine.objects.create(name_jp="B", astro_elements=["fire"], popular_score=8.0)  # 英語混入でもjaに寄せる

    call_command("backfill_astro_elements", "--mode", "rotate", "--seed", "1")

    elems = list(Shrine.objects.values_list("astro_elements", flat=True))
    # 2件とも「日本語の4元素のどれか」だけになっていること
    for e in elems:
        assert isinstance(e, list)
        assert len(e) == 1
        assert e[0] in ["火", "土", "風", "水"]
