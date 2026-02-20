# backend/temples/tests/services/test_concierge_llm_signals.py
import pytest

from temples.services.concierge_chat import build_chat_recommendations


def _min_input():
    return dict(
        query="厄除け",
        language="ja",
        candidates=[],   # ここは空でもOK（seedに落ちる）
        bias=None,
        birthdate=None,
        goriyaku_tag_ids=None,
        extra_condition=None,
        flow="A",
    )


@pytest.mark.django_db
def test_llm_disabled_used_must_be_false(settings, monkeypatch):
    # spec: enabled=false のとき used=true は禁止
    settings.CONCIERGE_USE_LLM = False

    # Orchestrator がどうであれ、used は false であるべき（仕様）
    out = build_chat_recommendations(**_min_input())

    llm = (out.get("_signals") or {}).get("llm") or {}
    assert llm.get("enabled") is False
    assert llm.get("used") is False


@pytest.mark.django_db
def test_llm_enabled_used_true_even_if_orchestrator_raises(settings, monkeypatch):
    # spec: enabled=true で suggest() を試行したなら、例外でも used=true
    settings.CONCIERGE_USE_LLM = True

    # Orchestrator().suggest を強制例外にする
    from temples.llm import orchestrator as orch_mod

    def _boom(*args, **kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(orch_mod.ConciergeOrchestrator, "suggest", _boom, raising=True)

    out = build_chat_recommendations(**_min_input())

    llm = (out.get("_signals") or {}).get("llm") or {}
    assert llm.get("enabled") is True
    assert llm.get("used") is True
    assert isinstance(llm.get("error"), str) and llm["error"]
