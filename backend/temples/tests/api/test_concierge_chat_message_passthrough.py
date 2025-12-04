# temples/tests/api/test_concierge_chat_message_passthrough.py
import json
import pytest

@pytest.mark.django_db
def test_concierge_message_passthrough(client, settings, monkeypatch):
    settings.GOOGLE_MAPS_API_KEY = "dummy"

    # Orchestrator.suggest が candidates の formatted_address を使う前提のダミー
    from temples.llm.orchestrator import ConciergeOrchestrator
    def _fake_suggest(self, query, candidates):
        assert candidates and candidates[0].get("formatted_address")  # パスされたことを検証
        return {"recommendations": [{"name": candidates[0]["name"], "reason": "ok"}]}

    monkeypatch.setattr(ConciergeOrchestrator, "suggest", _fake_suggest)

    payload = {
        "message": "テスト",
        "lat": 35.0,
        "lng": 139.0,
        "candidates": [
            {"name": "赤坂氷川神社", "formatted_address": "日本、〒107-0052 東京都港区赤坂6丁目10−12"}
        ],
    }
    r = client.post(
        "/api/concierge/chat/",
        data=json.dumps(payload),
        content_type="application/json",
    )
    assert r.status_code == 200
    body = r.json()
    assert body.get("ok") is True

    reply = body.get("reply", "")
    # 新仕様: 上位候補の名前を含む「候補: ...」形式
    assert reply.startswith("候補: ")
    assert "赤坂氷川神社" in reply
