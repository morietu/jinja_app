from __future__ import annotations

import pytest

from temples.services.concierge_chat import build_chat_recommendations
from temples.tests.fixtures.concierge_core_candidates import CONCIERGE_CORE_CANDIDATES


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("query", "expected_tag"),
    [
        ("受験に向けて学業成就を祈願したい", "study"),
        ("資格試験に受かりたい", "study"),
        ("転職を成功させたい", "career"),
        ("仕事で良い流れをつかみたい", "career"),
    ],
)
def test_need_taxonomy_separates_study_and_career(query, expected_tag, monkeypatch):

    recs = build_chat_recommendations(
        query=query,
        language="ja",
        candidates=CONCIERGE_CORE_CANDIDATES,
        birthdate=None,
        flow="A",
    )

    assert expected_tag in recs["_need"]["tags"]
