

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from temples.models import Shrine


@pytest.mark.django_db
def test_shrine_meaning_endpoint_returns_v2_payload():
    """未認証（anonymous）の v2 payload 契約。

    Premium entitlement は backend 側で判定するため、anonymous では
    premium 本文は返らない。plan ごとの shaping 契約は
    temples/tests/api/test_shrine_meaning_plan_entitlement.py が持つ。
    """

    shrine = Shrine.objects.create(
        kind="shrine",
        name_jp="例の神社",
        address="東京都世田谷区",
        latitude=35.0,
        longitude=139.0,
        goriyaku="厄除け / 縁結び",
        sajin="例の祭神",
        description="静かに心を整えやすい神社。",
        history_theme="再出発",
        element="木",
    )

    client = APIClient()
    url = reverse("temples:shrine_meaning", kwargs={"pk": shrine.pk})
    response = client.get(url)

    assert response.status_code == 200

    payload = response.json()
    assert payload["version"] == "v2"
    assert payload["source"]["shrineId"] == shrine.pk
    assert payload["source"]["nameJp"] == "例の神社"
    assert payload["source"]["goriyaku"] == "厄除け / 縁結び"
    assert payload["source"]["sajin"] == "例の祭神"
    assert payload["source"]["description"] == "静かに心を整えやすい神社。"
    assert payload["source"]["historyTheme"] == "再出発"

    assert payload["generated"]["heroMeaningCopy"]
    assert payload["generated"]["consultationSummary"]
    assert payload["generated"]["shrineMeaning"]

    # anonymous には premium 本文を返さない
    assert payload["generated"]["actionMeaning"] == ""
    assert payload["generated"]["historyContext"] is None
    assert payload["generated"]["deitySymbolContext"] is None
    assert payload["generated"]["benefitActionContext"] is None
    assert payload["generated"]["todayFlowContext"] is None
    assert payload["generated"]["afterVisitReflection"] is None

    blocks = payload["display"]["blocks"]
    assert blocks
    assert {block["access"] for block in blocks} == {"anonymous", "free"}
    assert payload["display"]["fallbackMessage"] is None


@pytest.mark.django_db
def test_shrine_meaning_endpoint_returns_404_for_missing_shrine():
    client = APIClient()
    url = reverse("temples:shrine_meaning", kwargs={"pk": 999999})
    response = client.get(url)

    assert response.status_code == 404
    assert response.json() == {"detail": "not found"}
