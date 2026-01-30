import datetime
import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from temples.models import Shrine, PlaceRef, ShrineCandidate


def _mk_shrine(place_id: str, *, name="テスト神社"):
    pr, _ = PlaceRef.objects.get_or_create(
        place_id=place_id,
        defaults={"name": name, "address": "住所", "latitude": 35.0, "longitude": 139.0},
    )
    s, _ = Shrine.objects.get_or_create(
        place_ref=pr,
        defaults={"name_jp": name, "address": "住所", "latitude": 35.0, "longitude": 139.0},
    )
    return s


@pytest.mark.django_db
def test_resolve_updates_synced_at_but_keeps_manual_source_and_imported_status():
    _mk_shrine("PID123")

    c = ShrineCandidate.objects.create(
        place_id="PID123",
        name_jp="手入力名",
        address="手入力住所",
        lat=1.0,
        lng=2.0,
        source=ShrineCandidate.Source.MANUAL,
        status=ShrineCandidate.Status.IMPORTED,
        synced_at=timezone.now() - datetime.timedelta(days=1),
        raw={},
    )
    old_synced = c.synced_at

    client = APIClient()
    res = client.post("/api/places/resolve/", {"place_id": "PID123"}, format="json")
    assert res.status_code == 200

    c.refresh_from_db()
    assert c.synced_at > old_synced
    assert c.source == ShrineCandidate.Source.MANUAL
    assert c.status == ShrineCandidate.Status.IMPORTED


@pytest.mark.django_db
def test_resolve_creates_candidate_auto_resolve_for_new_candidate():
    _mk_shrine("NEWPID001")

    # 既存candidate無しでresolve
    client = APIClient()
    res = client.post("/api/places/resolve/", {"place_id": "NEWPID001"}, format="json")
    assert res.status_code == 200
    body = res.json()
    assert "candidate_id" in body

    c = ShrineCandidate.objects.get(id=body["candidate_id"])
    assert c.status == ShrineCandidate.Status.AUTO
    assert c.source == ShrineCandidate.Source.RESOLVE
    assert c.synced_at is not None


@pytest.mark.django_db
def test_resolve_does_not_break_approved_or_rejected():
    _mk_shrine("PID777")

    for st in [ShrineCandidate.Status.APPROVED, ShrineCandidate.Status.REJECTED]:
        c = ShrineCandidate.objects.create(
            place_id="PID777",
            name_jp="候補",
            address="住所",
            source=ShrineCandidate.Source.MANUAL,
            status=st,
            synced_at=timezone.now() - datetime.timedelta(hours=1),
            raw={},
        )

        client = APIClient()
        res = client.post("/api/places/resolve/", {"place_id": "PID777"}, format="json")
        assert res.status_code == 200

        c.refresh_from_db()
        assert c.status == st
