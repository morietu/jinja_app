import re
import pytest
from rest_framework.test import APIClient

ISO_Z_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$")

@pytest.mark.django_db
def test_billing_status_contract_default(client: APIClient):
    res = client.get("/api/billings/status/")
    assert res.status_code == 200
    data = res.json()

    # 1) キー集合（これが“契約”）
    assert set(data.keys()) == {
        "plan",
        "is_active",
        "provider",
        "current_period_end",
        "trial_ends_at",
        "cancel_at_period_end",
    }

    # 2) 型と値域（最低限）
    assert data["plan"] in {"free", "premium"}
    assert isinstance(data["is_active"], bool)
    assert data["provider"] in {"stub", "stripe", "revenuecat", "unknown"}
    assert isinstance(data["cancel_at_period_end"], bool)

    # 3) 日付フィールド（null か ISO8601(Z)）
    if data["current_period_end"] is not None:
        assert isinstance(data["current_period_end"], str)
        assert ISO_Z_RE.match(data["current_period_end"])
    if data["trial_ends_at"] is not None:
        assert isinstance(data["trial_ends_at"], str)
        assert ISO_Z_RE.match(data["trial_ends_at"])


@pytest.mark.django_db
def test_billing_status_contract_premium_active(monkeypatch, client: APIClient):
    monkeypatch.setenv("BILLING_STUB_PLAN", "premium")
    monkeypatch.setenv("BILLING_STUB_ACTIVE", "1")
    monkeypatch.setenv("BILLING_PROVIDER", "stripe")

    res = client.get("/api/billings/status/")
    assert res.status_code == 200
    data = res.json()

    assert data["plan"] == "premium"
    assert data["is_active"] is True
    assert data["provider"] == "stripe"
    # active のときは current_period_end が入る想定（入らないならここで落ちる）
    assert data["current_period_end"] is not None
