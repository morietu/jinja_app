"""Weekly Presentation Domain (Weekly Compass v1 foundation).

このmoduleの責務は「既に確定しているCompass結果を、その週の表示として
どう固定するか」だけである。

責務境界（既存Authorityを一切奪わない）:

- 方位計算は `temples.domain.kyusei` / `temples.services.compass_runtime` の
  責務であり、ここでは `direction_context` を **入力として受け取るだけ**。
  再計算も補正もしない。
- 候補生成・距離段階・ranking は
  `temples.services.compass_recommendation_orchestrator` の責務であり、
  ここでは **既に順位付け済みのRecommendation結果** を入力として受け取るだけ。
  新しいscoreを作らず、既存scoreを変更せず、再rankingもしない。
- Weekly Theme（Presentation Copy）は
  `temples.domain.weekly_theme_catalog_v1` の責務。ここには置かない。

Presentation Copy と Recommendation Signal の分離:
Weekly Presentation は「どのShrineを上位6件から拾い上げて今週見せるか」だけを
決める。Recommendation の候補集合・順位・Reason には一切影響しない。
"""

from __future__ import annotations

import hashlib
import itertools
import json
from typing import Any, Iterable, Mapping, Optional, Sequence

# Weekly Presentation の版。Snapshot の一意性・determinism seed・Theme選択の
# すべてがこの値に紐づくため、文字列を複数箇所へ直書きせず必ずここを参照する。
WEEKLY_PRESENTATION_VERSION = "weekly_presentation_v1"

# Weekly が触れてよい候補範囲は「既存Recommendation結果の上位6件」まで。
# Recommendation結果の外からShrineを取得して補充することは禁止。
WEEKLY_POOL_LIMIT = 6

# 1週間に featured として表示する最大件数。
WEEKLY_FEATURED_LIMIT = 3

# direction_fingerprint の対象field。これ以外（targetDate / note 等の表示用
# field）は含めない -- 同一solar month内では targetDate が変わっても Compass
# direction 結果は同じであり、targetDate を含めると「同じ方位なのに毎日
# 別のWeekly Snapshotになる」ためである。
DIRECTION_FINGERPRINT_FIELDS = (
    "referenceDirections",
    "calculationMethod",
    "solarMonthIndex",
    "targetYear",
)

# Owner identity のprefix。既存 identity 設計（認証済み=user / 匿名=
# `temples.services.anonymous_id` が発行するanonymous_id）をそのまま使う。
# Weekly専用の匿名IDは作らない。
_OWNER_PREFIX_USER = "user"
_OWNER_PREFIX_ANONYMOUS = "anon"

# deterministic seed の区切り。値自体に現れない文字を使う。
_SEED_SEPARATOR = "|"

# seed namespace。Theme用seedとfeatured用seedが偶然一致しないよう、用途を
# seedの先頭へ明示する。
_SEED_NAMESPACE_THEME = "weekly_theme"
_SEED_NAMESPACE_FEATURED = "weekly_featured"


def _normalize_optional_int(value: Any) -> Optional[int]:
    """int相当の値だけを int へ正規化し、それ以外は None を返す。

    bool は int のサブクラスだが意味が異なるため明示的に除外する。
    """
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        try:
            return int(value.strip())
        except ValueError:
            return None
    return None


def _normalize_optional_str(value: Any) -> Optional[str]:
    if not isinstance(value, str):
        return None
    text = value.strip()
    return text or None


def _normalize_reference_directions(value: Any) -> list[str]:
    """`referenceDirections` を並び順に依存しない正規形へ変換する。

    同じ方位集合であれば、どの順序で渡されても同じ結果になる（重複除去 +
    昇順ソート）。ここで方位の意味づけ・優先順位づけは一切行わない
    （方位の意味はCompass Runtime Authorityの責務であり、Weeklyは持たない）。

    list / tuple 以外は「方位なし」として扱う。str を1要素として拾うような
    暗黙の解釈はしない。
    """
    if not isinstance(value, (list, tuple)):
        return []
    normalized = {
        direction.strip()
        for direction in value
        if isinstance(direction, str) and direction.strip()
    }
    return sorted(normalized)


def build_direction_fingerprint(direction_context: Optional[Mapping[str, Any]]) -> str:
    """`direction_context` から安定した SHA-256 fingerprint を生成する。

    canonicalization contract:
      - key order に依存しない（canonical payload を sort_keys で直列化）
      - `referenceDirections` の並び順に依存しない（正規化で昇順化）
      - key の欠落と明示的な None を同一視する
      - UTF-8 固定・deterministic・Python process をまたいでも同値

    Python built-in `hash()` は process ごとに PYTHONHASHSEED で変わるため
    使用しない。

    `direction_context` が Mapping でない場合（None / NoCommonDirectionResult
    など、そもそも方位が確定していない状態）は、全fieldが空のcanonical payload
    に対する fingerprint を返す。例外は送出しない -- fingerprint生成の失敗が
    Recommendation 全体の失敗になってはならないため。
    """
    source: Mapping[str, Any] = direction_context if isinstance(direction_context, Mapping) else {}
    canonical_payload = {
        "referenceDirections": _normalize_reference_directions(source.get("referenceDirections")),
        "calculationMethod": _normalize_optional_str(source.get("calculationMethod")),
        "solarMonthIndex": _normalize_optional_int(source.get("solarMonthIndex")),
        "targetYear": _normalize_optional_int(source.get("targetYear")),
    }
    serialized = json.dumps(
        canonical_payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def build_weekly_owner_key(
    *,
    user_id: Optional[int] = None,
    anonymous_id: Optional[str] = None,
) -> str:
    """Snapshot の Owner identity を deterministic seed 用の文字列へ落とす。

    Owner は必ず一種類だけ（Owner XOR）。`WeeklyPresentationSnapshot` の
    DB constraint と同じ規則を Domain 側でも強制し、両方が null / 両方が
    非null の状態が seed へ到達しないようにする。
    """
    normalized_anonymous_id = _normalize_optional_str(anonymous_id)
    has_user = user_id is not None
    has_anonymous = normalized_anonymous_id is not None

    if has_user == has_anonymous:
        raise ValueError(
            "weekly presentation owner must be exactly one of user_id / anonymous_id"
        )
    if has_user:
        return f"{_OWNER_PREFIX_USER}:{user_id}"
    return f"{_OWNER_PREFIX_ANONYMOUS}:{normalized_anonymous_id}"


def _week_start_text(week_start: Any) -> str:
    return week_start.isoformat() if hasattr(week_start, "isoformat") else str(week_start)


def build_weekly_theme_seed(
    *,
    week_start: Any,
    purpose: str,
    direction_fingerprint: str,
    presentation_version: str,
) -> str:
    """Weekly Theme選択用の deterministic seed。

    Theme は Presentation Copy であり Owner ごとに変えない（同じ週・同じ
    purpose・同じCompass Contextなら誰にとっても同じ文言）。したがって
    owner identity を **含めない** -- featured選択のseedとは意図的に別物である。

    `recommendation_instance_id` のような request ごとに変わる値は
    絶対に含めない（Reproducibility Contract）。
    """
    return _SEED_SEPARATOR.join(
        [
            _SEED_NAMESPACE_THEME,
            str(presentation_version),
            _week_start_text(week_start),
            str(purpose),
            str(direction_fingerprint),
        ]
    )


def build_weekly_featured_seed(
    *,
    owner_key: str,
    week_start: Any,
    purpose: str,
    direction_fingerprint: str,
    presentation_version: str,
) -> str:
    """featured shrine選択用の deterministic seed。

    Theme用seedとは先頭のnamespaceで区別されるため、同じ引数から同じ値が
    生まれることはない。

    `recommendation_instance_id` のような request ごとに変わる値は
    絶対に含めない（Reproducibility Contract）。
    """
    return _SEED_SEPARATOR.join(
        [
            _SEED_NAMESPACE_FEATURED,
            str(presentation_version),
            str(owner_key),
            _week_start_text(week_start),
            str(purpose),
            str(direction_fingerprint),
        ]
    )


def stable_index(seed: str, modulus: int) -> int:
    """seed 文字列から deterministic に [0, modulus) のindexを決める。

    runtime random（`random` module）も Python built-in `hash()` も使わない。
    SHA-256 digest の先頭16byteを整数化して剰余を取る。
    """
    if modulus <= 0:
        raise ValueError("modulus must be positive")
    digest = hashlib.sha256(seed.encode("utf-8")).digest()
    return int.from_bytes(digest[:16], "big") % modulus


def _resolve_shrine_id(recommendation: Any) -> Optional[int]:
    """Recommendation entry から Shrine ID を取り出す。

    key解決順（`shrine_id` -> `id`）は既存Recommendation層の慣習
    （`concierge_chat_pool` / `concierge_chat_ranking` と同一）をそのまま
    踏襲する。Weekly側で独自のID解決規則を作らない。
    """
    if not isinstance(recommendation, Mapping):
        return None
    raw = recommendation.get("shrine_id")
    if raw is None:
        raw = recommendation.get("id")
    return _normalize_optional_int(raw)


def build_weekly_pool(recommendations: Optional[Iterable[Any]]) -> list[int]:
    """既存Recommendation結果から Weekly の candidate universe を作る。

    - 元の順位をそのまま維持する（並べ替えない）
    - 同一Shrineの重複は最初の出現だけ残す
    - ID を解決できないentryは落とす（外部から補充はしない）
    - 上位 `WEEKLY_POOL_LIMIT` 件で打ち切る
    """
    pool: list[int] = []
    seen: set[int] = set()
    for recommendation in recommendations or []:
        shrine_id = _resolve_shrine_id(recommendation)
        if shrine_id is None or shrine_id in seen:
            continue
        seen.add(shrine_id)
        pool.append(shrine_id)
        if len(pool) >= WEEKLY_POOL_LIMIT:
            break
    return pool


def select_featured_shrine_ids(
    *,
    recommendations: Optional[Sequence[Any]],
    owner_key: str,
    week_start: Any,
    purpose: str,
    direction_fingerprint: str,
    presentation_version: str = WEEKLY_PRESENTATION_VERSION,
) -> list[int]:
    """今週 featured として表示する Shrine ID を deterministic に選ぶ。

    Candidate universe は「既存Recommendation結果の上位 `WEEKLY_POOL_LIMIT`
    件」のみ。Recommendation対象外のShrineで補充しない。

    Fail-safe（候補不足時）:
        6件以上 -> 上位6件から最大3件
        3〜5件  -> そのcandidate集合から最大3件
        1〜2件  -> 全件
        0件     -> 空

    Order: 選択後の表示順は必ず元のRecommendation順位を維持する
    （`itertools.combinations` が返すindex組は昇順なので、再orderingは起きない）。
    """
    pool = build_weekly_pool(recommendations)
    if len(pool) <= WEEKLY_FEATURED_LIMIT:
        # 0〜3件はそのまま全件。ここで「3件に満たないから補充する」ことはしない。
        return pool

    # pool は最大 WEEKLY_POOL_LIMIT (6) 件なので、組み合わせは最大 C(6,3)=20 通り。
    # 全列挙してseedでindexを選ぶ方式は、pool長が変わっても同じ規則で説明でき、
    # かつ選択結果が必ず昇順index（=元順位順）になる。
    combinations = list(itertools.combinations(range(len(pool)), WEEKLY_FEATURED_LIMIT))
    seed = build_weekly_featured_seed(
        owner_key=owner_key,
        week_start=week_start,
        purpose=purpose,
        direction_fingerprint=direction_fingerprint,
        presentation_version=presentation_version,
    )
    chosen = combinations[stable_index(seed, len(combinations))]
    return [pool[index] for index in chosen]


__all__ = [
    "WEEKLY_PRESENTATION_VERSION",
    "WEEKLY_POOL_LIMIT",
    "WEEKLY_FEATURED_LIMIT",
    "DIRECTION_FINGERPRINT_FIELDS",
    "build_direction_fingerprint",
    "build_weekly_owner_key",
    "build_weekly_theme_seed",
    "build_weekly_featured_seed",
    "stable_index",
    "build_weekly_pool",
    "select_featured_shrine_ids",
]
