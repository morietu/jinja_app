import json
from django.test import RequestFactory

from backend.shrine_project import views


def test_index_json_response():
    rf = RequestFactory()
    resp = views.index(rf.get("/"))
    assert resp.status_code == 200
    data = json.loads(resp.content.decode())
    # 代表キーだけ軽く確認（厳密にしすぎない）
    assert data["status"] == "ok"
    assert data["endpoints"]["shrines"] == "/api/shrines/"


def test_favicon_empty_ico():
    rf = RequestFactory()
    resp = views.favicon(rf.get("/favicon.ico"))
    assert resp.status_code == 200
    assert resp["Content-Type"] == "image/x-icon"
    assert resp.content == b""
