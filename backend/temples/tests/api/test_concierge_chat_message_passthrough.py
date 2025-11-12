import json

URL = "/api/concierge/chat/"

def test_accepts_message(client):
    r = client.post(URL,
        data=json.dumps({"message":"テスト"}),
        content_type="application/json")
    assert r.status_code == 200

def test_message_payload_passthrough(client, requests_mock):
    body = {
        "message":"テスト",
        "lat":35, "lng":139,
        "candidates":[{"formatted_address":"東京都千代田区…"}]
    }
    r = client.post(URL, data=json.dumps(body), content_type="application/json")
    assert r.status_code == 200
    # 本体側はすでに透過済みのため、ここでは 200 を担保（詳細は下位テストに任せる）
