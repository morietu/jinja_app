"""一覧APIがcreated_atという事実を返すことの契約テスト。

「新着」判定そのものはFrontendの責務であり、Backendはcreated_atを返すだけ。
ここではfieldが実レスポンスに載っていることと、ISO 8601として解釈できることのみ確認する。
"""

from datetime import datetime

import pytest
from rest_framework.test import APIClient

from temples.api.serializers.shrine import ShrineListSerializer
from temples.models import Shrine

pytestmark = pytest.mark.django_db


def test_shrine_list_serializer_declares_created_at():
    assert "created_at" in ShrineListSerializer.Meta.fields


def test_shrine_list_api_returns_created_at():
    Shrine.objects.create(
        name_jp="新着確認神社",
        address="東京都千代田区1-1",
        kind="shrine",
    )

    client = APIClient()
    res = client.get("/api/shrines/?q=新着確認神社")

    assert res.status_code == 200

    data = res.json()
    rows = data.get("results", data)
    row = next(r for r in rows if r["name_jp"] == "新着確認神社")

    assert "created_at" in row
    assert isinstance(row["created_at"], str)
    # DRFのDateTimeFieldはISO 8601で返す（末尾Zはfromisoformatが解釈できないので+00:00へ寄せる）
    datetime.fromisoformat(row["created_at"].replace("Z", "+00:00"))


def test_shrine_list_api_created_at_is_read_only():
    """created_atは書き込み対象ではない（read_only_fieldsのまま）。"""
    serializer = ShrineListSerializer()
    assert serializer.fields["created_at"].read_only is True
