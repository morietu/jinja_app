"""Weekly featured shrines の hydration（Snapshot ID -> 既存Shrine公開表現）.

`WeeklyPresentationSnapshot.featured_shrine_ids` にはShrine IDしか保存されて
いない（Shrine詳細の複製禁止）。Responseではカード表示可能な表現へ戻す必要が
あるが、ここで新しいShrine serializer / copy contract を発明しない。

再利用する既存Authority（いずれもこのmoduleでは再定義しない）:

- 公開表現: `temples.api.serializers.shrine.ShrineListSerializer`
  Shrine一覧・nearest・rankingが既に使っている「Shrineカード列」の公開表現。
  Frontendの `buildShrineCardProps()` が読む `Shrine` 型と同じ系列である。
- `is_favorite` 注釈: `temples.api.queryutils.annotate_is_favorite`
  ShrineListSerializer を使う既存Viewが必ず通している注釈。
- 可視性/eligibility: Shared Recommendation Eligibility gate
  （`concierge_chat_candidates.is_recommendation_eligible` +
  `shrine_knowledge_selector.fetch_fact_ready_knowledge_*`）と
  `shrine_qa_fixture_exclusion.exclude_qa_fixture_shrines`、および
  共有候補層と同じ構造条件（座標あり / address非空）。

Weekly独自のeligibility ruleは作らない。判定式は共有層の1箇所を呼ぶだけである。

Fail-safe（v1）:
Snapshot保存後にShrineがdeleted / 表示不可になった場合、そのShrineをResponse
から除外するだけで、4位以降による補充はしない（Snapshot自体も書き換えない）。
"""

from __future__ import annotations

import logging
from typing import Any, Optional, Sequence

from temples.api.queryutils import annotate_is_favorite
from temples.api.serializers.shrine import ShrineListSerializer
from temples.models import Shrine
from temples.services.concierge_chat_candidates import is_recommendation_eligible
from temples.services.shrine_knowledge_selector import (
    fetch_fact_ready_knowledge_deities,
    fetch_fact_ready_knowledge_histories,
)
from temples.services.shrine_qa_fixture_exclusion import exclude_qa_fixture_shrines

log = logging.getLogger(__name__)


def _normalized_ids(shrine_ids: Optional[Sequence[Any]]) -> list[int]:
    """保存順を維持したまま、int化できるIDだけを重複なく取り出す。"""
    normalized: list[int] = []
    seen: set[int] = set()
    for raw in shrine_ids or []:
        if isinstance(raw, bool):
            continue
        if isinstance(raw, int):
            shrine_id = raw
        elif isinstance(raw, str) and raw.strip().lstrip("-").isdigit():
            shrine_id = int(raw.strip())
        else:
            continue
        if shrine_id in seen:
            continue
        seen.add(shrine_id)
        normalized.append(shrine_id)
    return normalized


def _available_shrine_queryset(ids: Sequence[int], request: Any = None):
    """共有層と同一の構造条件だけを課したQuerySetを返す（新条件は足さない）。"""
    queryset = Shrine.objects.filter(id__in=list(ids))
    queryset = exclude_qa_fixture_shrines(queryset)
    # build_chat_candidates_with_eligibility が候補母集団へ課している構造条件と同一。
    queryset = queryset.filter(latitude__isnull=False, longitude__isnull=False).exclude(address="")
    queryset = queryset.select_related("place_ref").prefetch_related("goriyaku_tags")
    if request is not None:
        # ShrineListSerializer が要求する is_favorite 注釈。既存Authorityを通し、
        # Weekly側で独自のfavorite判定を書かない。
        queryset = annotate_is_favorite(queryset, request)
    return queryset


def resolve_available_shrines(
    shrine_ids: Optional[Sequence[Any]],
    *,
    request: Any = None,
) -> dict[int, Shrine]:
    """現在表示可能なShrineだけを `{id: Shrine}` で返す。

    「表示可能」の判定は共有層のAuthorityをそのまま使う:
      - 存在すること（deletedなら当然ここで落ちる）
      - QA fixture Shrineでないこと（exclude_qa_fixture_shrines）
      - 共有候補層と同じ構造条件（座標あり / address非空）
      - Shared Recommendation Eligibility（usable Deity Fact OR usable History Fact）
    """
    ids = _normalized_ids(shrine_ids)
    if not ids:
        return {}

    shrines = {shrine.id: shrine for shrine in _available_shrine_queryset(ids, request)}
    if not shrines:
        return {}

    present_ids = list(shrines)
    deities_by_shrine = fetch_fact_ready_knowledge_deities(present_ids)
    histories_by_shrine = fetch_fact_ready_knowledge_histories(present_ids)

    return {
        shrine_id: shrine
        for shrine_id, shrine in shrines.items()
        if is_recommendation_eligible(
            knowledge_deities=deities_by_shrine.get(shrine_id, []),
            knowledge_histories=histories_by_shrine.get(shrine_id, []),
        )
    }


def hydrate_featured_shrines(
    *,
    shrine_ids: Optional[Sequence[Any]],
    request: Any,
) -> list[dict[str, Any]]:
    """Snapshotの `featured_shrine_ids` を既存Shrine公開表現へhydrateする。

    順序は **必ず `shrine_ids` の順** を維持する。DB queryの返却順へ依存しない
    （`filter(id__in=...)` の順序はSQL上保証されないため、明示的に並べ直す）。

    表示不可になったShrineは除外されるだけで、補充はしない（Snapshotも書き換えない）。
    """
    ids = _normalized_ids(shrine_ids)
    if not ids:
        return []

    available = resolve_available_shrines(ids, request=request)
    ordered = [available[shrine_id] for shrine_id in ids if shrine_id in available]
    if not ordered:
        return []

    if len(ordered) != len(ids):
        log.info(
            "[weekly_featured] unavailable_shrines_excluded stored=%d rendered=%d",
            len(ids),
            len(ordered),
        )

    return list(
        ShrineListSerializer(ordered, many=True, context={"request": request}).data
    )


__all__ = [
    "resolve_available_shrines",
    "hydrate_featured_shrines",
]
