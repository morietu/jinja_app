"""Shrine Meaning API の Premium entitlement 契約テスト。

対象:
- GET /api/shrines/{id}/meaning/
- plan は backend の resolve_plan_context(request) だけを正本とする
- anonymous / free では premium 本文を返さない
- premium では現行 payload をそのまま返す
"""

import json

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from temples.models import Shrine
from temples.services.shrine_meaning_access import (
    PREMIUM_GENERATED_OPTIONAL_TEXT_FIELDS,
    PREMIUM_GENERATED_REQUIRED_TEXT_FIELDS,
    PREMIUM_SOURCE_RESTORATION_FIELDS,
    allowed_access_levels_for_plan,
    shape_shrine_meaning_payload_for_plan,
)

PREMIUM_GENERATED_FIELDS = (
    PREMIUM_GENERATED_REQUIRED_TEXT_FIELDS + PREMIUM_GENERATED_OPTIONAL_TEXT_FIELDS
)


def _create_shrine() -> Shrine:
    return Shrine.objects.create(
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


def _meaning_url(shrine: Shrine) -> str:
    return reverse("temples:shrine_meaning", kwargs={"pk": shrine.pk})


def _fetch(client: APIClient, shrine: Shrine, **kwargs):
    response = client.get(_meaning_url(shrine), **kwargs)
    assert response.status_code == 200
    return response.json()


def _premium_texts(payload: dict) -> list[str]:
    """premium 本文として応答へ現れうるテキストを集める。"""

    texts: list[str] = []
    for key in PREMIUM_GENERATED_FIELDS:
        value = payload["generated"].get(key)
        if isinstance(value, str) and value.strip():
            texts.append(value)
    for block in payload["display"]["blocks"]:
        if block.get("access") == "premium":
            body = block.get("body")
            if isinstance(body, str) and body.strip():
                texts.append(body)
    return texts


def _assert_no_premium_body(payload: dict, premium_payload: dict) -> None:
    """premium 本文が「復元可能な形で」残っていないことを確認する。"""

    # generated の premium 本文が落ちている
    for key in PREMIUM_GENERATED_REQUIRED_TEXT_FIELDS:
        assert payload["generated"][key] == ""
    for key in PREMIUM_GENERATED_OPTIONAL_TEXT_FIELDS:
        assert payload["generated"].get(key) is None

    # display の premium block が送られていない
    assert all(block["access"] != "premium" for block in payload["display"]["blocks"])

    # source の premium 本文復元経路が落ちている
    for key in PREMIUM_SOURCE_RESTORATION_FIELDS:
        assert payload["source"].get(key) is None

    # premium 応答に含まれる本文が、応答 JSON のどこにも現れない
    serialized = json.dumps(payload, ensure_ascii=False)
    premium_texts = _premium_texts(premium_payload)
    assert premium_texts, "premium payload に premium 本文が無いとテストが無意味になる"
    for text in premium_texts:
        assert text not in serialized


def _assert_public_free_kept(payload: dict) -> None:
    assert payload["version"] == "v2"
    assert payload["source"]["nameJp"] == "例の神社"
    assert payload["source"]["goriyaku"] == "厄除け / 縁結び"
    assert payload["source"]["address"] == "東京都世田谷区"
    assert payload["generated"]["heroMeaningCopy"]
    assert payload["generated"]["consultationSummary"]
    assert payload["generated"]["shrineMeaning"]

    access_levels = {block["access"] for block in payload["display"]["blocks"]}
    assert access_levels == {"anonymous", "free"}


def _premium_payload(shrine: Shrine, monkeypatch) -> dict:
    monkeypatch.setenv("BILLING_STUB_PLAN", "premium")
    monkeypatch.setenv("BILLING_STUB_ACTIVE", "1")

    from django.contrib.auth import get_user_model

    user = get_user_model().objects.create_user(
        username="premium-reference",
        password="pw",
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return _fetch(client, shrine)


@pytest.mark.django_db
def test_anonymous_request_is_shaped_as_anonymous(monkeypatch):
    shrine = _create_shrine()
    premium_payload = _premium_payload(shrine, monkeypatch)

    monkeypatch.setenv("BILLING_STUB_PLAN", "free")
    monkeypatch.setenv("BILLING_STUB_ACTIVE", "0")

    payload = _fetch(APIClient(), shrine)

    _assert_public_free_kept(payload)
    _assert_no_premium_body(payload, premium_payload)


@pytest.mark.django_db
def test_authenticated_free_request_is_shaped_as_free(monkeypatch, django_user_model):
    shrine = _create_shrine()
    premium_payload = _premium_payload(shrine, monkeypatch)

    monkeypatch.setenv("BILLING_STUB_PLAN", "free")
    monkeypatch.setenv("BILLING_STUB_ACTIVE", "0")

    user = django_user_model.objects.create_user(username="free-user", password="pw")
    assert user.is_staff is False

    client = APIClient()
    client.force_authenticate(user=user)
    payload = _fetch(client, shrine)

    _assert_public_free_kept(payload)
    _assert_no_premium_body(payload, premium_payload)


@pytest.mark.django_db
def test_authenticated_premium_request_keeps_premium_body(monkeypatch, django_user_model):
    shrine = _create_shrine()

    monkeypatch.setenv("BILLING_STUB_PLAN", "premium")
    monkeypatch.setenv("BILLING_STUB_ACTIVE", "1")

    user = django_user_model.objects.create_user(username="premium-user", password="pw")
    client = APIClient()
    client.force_authenticate(user=user)
    payload = _fetch(client, shrine)

    # premium は現行 payload をそのまま受け取れる
    assert payload["generated"]["actionMeaning"]
    assert payload["generated"]["historyContext"]
    assert payload["generated"]["deitySymbolContext"]
    assert payload["generated"]["benefitActionContext"]
    assert payload["generated"]["afterVisitReflection"]

    access_levels = {block["access"] for block in payload["display"]["blocks"]}
    assert access_levels == {"anonymous", "free", "premium"}
    assert all(block["body"] for block in payload["display"]["blocks"])
    assert payload["display"]["fallbackMessage"] is None


@pytest.mark.django_db
def test_client_supplied_plan_does_not_upgrade_anonymous(monkeypatch):
    shrine = _create_shrine()
    premium_payload = _premium_payload(shrine, monkeypatch)

    monkeypatch.setenv("BILLING_STUB_PLAN", "free")
    monkeypatch.setenv("BILLING_STUB_ACTIVE", "0")

    client = APIClient()
    client.cookies["plan"] = "premium"
    response = client.get(
        _meaning_url(shrine),
        {"plan": "premium", "access": "premium", "tier": "premium"},
        HTTP_X_PLAN="premium",
        HTTP_X_USER_PLAN="premium",
    )

    assert response.status_code == 200
    _assert_no_premium_body(response.json(), premium_payload)


@pytest.mark.django_db
def test_client_supplied_plan_does_not_upgrade_authenticated_free(monkeypatch, django_user_model):
    shrine = _create_shrine()
    premium_payload = _premium_payload(shrine, monkeypatch)

    monkeypatch.setenv("BILLING_STUB_PLAN", "free")
    monkeypatch.setenv("BILLING_STUB_ACTIVE", "0")

    user = django_user_model.objects.create_user(username="free-user-2", password="pw")
    client = APIClient()
    client.force_authenticate(user=user)
    response = client.get(_meaning_url(shrine), {"plan": "premium"}, HTTP_X_PLAN="premium")

    assert response.status_code == 200
    _assert_no_premium_body(response.json(), premium_payload)


@pytest.mark.django_db
def test_billing_stub_premium_env_does_not_upgrade_anonymous(monkeypatch):
    """未認証は billing stub が premium でも anonymous として扱う。"""

    shrine = _create_shrine()
    premium_payload = _premium_payload(shrine, monkeypatch)

    # premium env のまま未認証でアクセスする
    payload = _fetch(APIClient(), shrine)
    _assert_no_premium_body(payload, premium_payload)


@pytest.mark.django_db
def test_source_restoration_paths_are_removed_for_free(monkeypatch, django_user_model):
    """interpretationProfile / translationResult が premium 本文の復元経路にならない。"""

    shrine = _create_shrine()

    from temples.api.views import shrine_meaning as view_module

    original_compose = view_module.compose_shrine_meaning_payload

    def compose_with_translation(source):
        payload = original_compose(source)
        payload["source"]["interpretationProfile"] = {
            "need_profile": {"primary_need": "career"},
            "action_intent": {"primary_action": "visit"},
        }
        payload["source"]["translationResult"] = {
            "history_theme": "再出発",
            "action_context": "実際に足を運び、今の状態を確認する",
            "reflection_question_seed": "次に進むために何を手放すか",
            "source": {"history_theme": "direction_profile"},
        }
        return payload

    monkeypatch.setattr(view_module, "compose_shrine_meaning_payload", compose_with_translation)

    monkeypatch.setenv("BILLING_STUB_PLAN", "free")
    monkeypatch.setenv("BILLING_STUB_ACTIVE", "0")

    user = django_user_model.objects.create_user(username="free-user-3", password="pw")
    client = APIClient()
    client.force_authenticate(user=user)
    payload = _fetch(client, shrine)

    assert payload["source"]["interpretationProfile"] is None
    assert payload["source"]["translationResult"] is None

    serialized = json.dumps(payload, ensure_ascii=False)
    assert "reflection_question_seed" not in serialized
    assert "action_context" not in serialized
    assert "実際に足を運び、今の状態を確認する" not in serialized
    assert "次に進むために何を手放すか" not in serialized


@pytest.mark.django_db
def test_source_restoration_paths_are_kept_for_premium(monkeypatch, django_user_model):
    shrine = _create_shrine()

    from temples.api.views import shrine_meaning as view_module

    original_compose = view_module.compose_shrine_meaning_payload

    def compose_with_translation(source):
        payload = original_compose(source)
        payload["source"]["translationResult"] = {"history_theme": "再出発"}
        return payload

    monkeypatch.setattr(view_module, "compose_shrine_meaning_payload", compose_with_translation)

    monkeypatch.setenv("BILLING_STUB_PLAN", "premium")
    monkeypatch.setenv("BILLING_STUB_ACTIVE", "1")

    user = django_user_model.objects.create_user(username="premium-user-2", password="pw")
    client = APIClient()
    client.force_authenticate(user=user)
    payload = _fetch(client, shrine)

    assert payload["source"]["translationResult"] == {"history_theme": "再出発"}


@pytest.mark.django_db
def test_anonymous_is_not_rejected_with_401():
    shrine = _create_shrine()
    response = APIClient().get(_meaning_url(shrine))
    assert response.status_code == 200


@pytest.mark.django_db
def test_missing_shrine_still_returns_404():
    response = APIClient().get(reverse("temples:shrine_meaning", kwargs={"pk": 999999}))
    assert response.status_code == 404
    assert response.json() == {"detail": "not found"}


@pytest.mark.django_db
def test_payload_generation_failure_still_returns_500(monkeypatch):
    shrine = _create_shrine()

    from temples.api.views import shrine_meaning as view_module

    def boom(_source):
        raise RuntimeError("compose failed")

    monkeypatch.setattr(view_module, "compose_shrine_meaning_payload", boom)

    response = APIClient().get(_meaning_url(shrine))
    assert response.status_code == 500
    assert response.json() == {"detail": "meaning payload generation failed"}


# --- shaping service unit tests ---


def _full_payload() -> dict:
    return {
        "version": "v2",
        "source": {
            "shrineId": 1,
            "nameJp": "例の神社",
            "goriyaku": "厄除け",
            "interpretationProfile": {"need_profile": {"primary_need": "career"}},
            "translationResult": {"action_context": "premium seed"},
        },
        "generated": {
            "heroMeaningCopy": "hero",
            "consultationSummary": "summary",
            "shrineMeaning": "meaning",
            "actionMeaning": "premium action",
            "historyContext": "premium history",
            "deitySymbolContext": "premium deity",
            "benefitActionContext": "premium benefit",
            "todayFlowContext": "premium flow",
            "afterVisitReflection": "premium reflection",
            "directionSupportCopy": "direction",
        },
        "display": {
            "blocks": [
                {"id": "hero", "title": "h", "body": "hero", "access": "anonymous"},
                {"id": "shrine_meaning", "title": "s", "body": "meaning", "access": "free"},
                {"id": "action_meaning", "title": "a", "body": "premium action", "access": "premium"},
            ],
            "fallbackMessage": None,
        },
    }


@pytest.mark.parametrize(
    "plan,expected",
    [
        ("anonymous", {"anonymous", "free"}),
        ("free", {"anonymous", "free"}),
        ("premium", {"anonymous", "free", "premium"}),
        ("unknown", {"anonymous", "free"}),
        (None, {"anonymous", "free"}),
    ],
)
def test_allowed_access_levels_for_plan(plan, expected):
    assert set(allowed_access_levels_for_plan(plan)) == expected


def test_shape_keeps_everything_for_premium():
    payload = _full_payload()
    shaped = shape_shrine_meaning_payload_for_plan(payload, plan="premium")
    assert shaped == payload


@pytest.mark.parametrize("plan", ["anonymous", "free", "unknown", None])
def test_shape_drops_premium_body_for_non_premium(plan):
    payload = _full_payload()
    shaped = shape_shrine_meaning_payload_for_plan(payload, plan=plan)

    assert shaped["generated"]["actionMeaning"] == ""
    for key in PREMIUM_GENERATED_OPTIONAL_TEXT_FIELDS:
        assert shaped["generated"][key] is None
    assert shaped["source"]["interpretationProfile"] is None
    assert shaped["source"]["translationResult"] is None
    assert [block["id"] for block in shaped["display"]["blocks"]] == ["hero", "shrine_meaning"]

    # public/free は維持される
    assert shaped["source"]["goriyaku"] == "厄除け"
    assert shaped["generated"]["heroMeaningCopy"] == "hero"
    assert shaped["generated"]["consultationSummary"] == "summary"
    assert shaped["generated"]["shrineMeaning"] == "meaning"
    assert shaped["generated"]["directionSupportCopy"] == "direction"

    # 入力 payload は変更されない
    assert payload == _full_payload()


def test_shape_treats_unknown_block_access_as_premium():
    payload = _full_payload()
    payload["display"]["blocks"].append(
        {"id": "history_context", "title": "x", "body": "leak", "access": "internal"}
    )
    shaped = shape_shrine_meaning_payload_for_plan(payload, plan="free")
    assert all(block["body"] != "leak" for block in shaped["display"]["blocks"])


def test_shape_sets_fallback_message_when_all_blocks_removed():
    payload = _full_payload()
    payload["display"]["blocks"] = [
        {"id": "action_meaning", "title": "a", "body": "premium action", "access": "premium"},
    ]
    shaped = shape_shrine_meaning_payload_for_plan(payload, plan="free")
    assert shaped["display"]["blocks"] == []
    assert shaped["display"]["fallbackMessage"] == "神社の意味情報はまだ準備中です。"
