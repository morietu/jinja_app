# backend/temples/models_weekly_presentation.py
"""WeeklyPresentationSnapshot（Weekly Compass v1）.

責務: **そのOwnerへ、その週に実際に表示すると確定したWeekly Presentation結果を
固定すること**だけ。計算材料を何でも保存するModelではない。

保存しないもの（意図的な非保存 -- 追加しないこと）:
    week_end                  -> week_start から導出する（derive_week_end）
    birthdate / target_date   -> 方位計算の入力であり、表示結果ではない
    origin / latitude / longitude
    raw direction_context     -> direction_fingerprint に畳んで保存する
    recommendation_instance_id-> requestごとに変わる値。determinismへ使わない
    distance_stage_km / candidate counts / raw recommendations
    Shrine詳細（name / address / image / description）-> Shrineの正本を複製しない
"""

from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone


class WeeklyPresentationSnapshot(models.Model):
    # --- Owner（既存Identity設計を再利用。Weekly専用の匿名IDは作らない） ---
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="weekly_presentation_snapshots",
        null=True,
        blank=True,
    )
    # 長さは既存 `ConciergeThread.anonymous_id`（max_length=64）に合わせる。
    # db_index は付けない -- 下の匿名Owner用 UniqueConstraint が
    # anonymous_id を先頭に持つ部分indexを作るため、単独indexは重複になる。
    anonymous_id = models.CharField(max_length=64, null=True, blank=True)

    # --- Weekly Presentation Context ---
    # Monday の日付のみを保存する（Time Contract: Asia/Tokyo / week starts Monday）。
    week_start = models.DateField()
    # 既存Compass purpose slug（`temples.domain.need_tags.NEED_TAGS`）。
    # Weekly専用のenumは作らない。
    purpose = models.CharField(max_length=32)
    # `weekly_presentation.build_direction_fingerprint()` が返す SHA-256 hex（64文字）。
    direction_fingerprint = models.CharField(max_length=64)

    # --- 確定した表示結果 ---
    # Snapshot時点で実際に表示するTheme（key / title / message）をそのまま保存する。
    # key だけを保存しないのは、Catalogが将来変更されても同じ週の表示結果を
    # 変えないため。
    weekly_theme = models.JSONField(default=dict)
    # 選択済みShrine IDの順序付き配列。順序＝表示順（元Recommendation順位）。
    # Shrine詳細はここへ複製しない。
    featured_shrine_ids = models.JSONField(default=list, blank=True)

    presentation_version = models.CharField(max_length=64)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "temples_weekly_presentation_snapshot"
        ordering = ["-week_start", "-id"]
        constraints = [
            # Owner XOR: 必ず user / anonymous_id のどちらか一方だけを持つ。
            # Application validation だけに依存せず DB で保証する。
            models.CheckConstraint(
                condition=(
                    (models.Q(user__isnull=False) & models.Q(anonymous_id__isnull=True))
                    | (models.Q(user__isnull=True) & models.Q(anonymous_id__isnull=False))
                ),
                name="chk_weekly_presentation_snapshot_owner_xor",
            ),
            # Snapshot Uniqueness:
            #   owner + week_start + purpose + direction_fingerprint + presentation_version
            # user / anonymous_id はどちらもnullableなので、単一のUniqueConstraintでは
            # NULL semantics（SQLではNULL同士が等しくない）に依存した穴が残る。
            # Owner種別ごとのconditional UniqueConstraintへ分け、それぞれの条件下で
            # 対象columnが必ずNOT NULLになるようにする（既存 Favorite の
            # uq_favorite_user_shrine / uq_favorite_user_place と同じ方式）。
            models.UniqueConstraint(
                fields=[
                    "user",
                    "week_start",
                    "purpose",
                    "direction_fingerprint",
                    "presentation_version",
                ],
                condition=models.Q(user__isnull=False),
                name="uq_weekly_presentation_snapshot_user",
            ),
            models.UniqueConstraint(
                fields=[
                    "anonymous_id",
                    "week_start",
                    "purpose",
                    "direction_fingerprint",
                    "presentation_version",
                ],
                condition=models.Q(anonymous_id__isnull=False),
                name="uq_weekly_presentation_snapshot_anonymous",
            ),
        ]

    def __str__(self) -> str:
        owner = f"user:{self.user_id}" if self.user_id else f"anon:{self.anonymous_id}"
        return f"WeeklyPresentationSnapshot({owner}, {self.week_start}, {self.purpose})"
