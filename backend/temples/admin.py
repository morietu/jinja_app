# backend/temples/admin.py
from __future__ import annotations

from django.apps import apps
from django.contrib import admin

from .models import Goshuin, GoshuinImage, ShrineCandidate, ShrineSubmission
from django.utils import timezone
from django.contrib import messages
from temples.services.shrine_submission import (
    ShrineSubmissionDuplicateError,
    ShrineSubmissionInvalidStateError,
    approve_shrine_submission,
)


@admin.register(Goshuin)
class GoshuinAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "shrine", "title", "is_public", "created_at")
    list_filter = ("is_public", "created_at")
    search_fields = ("title", "user__username", "shrine__name_jp")


@admin.register(GoshuinImage)
class GoshuinImageAdmin(admin.ModelAdmin):
    list_display = ("id", "goshuin", "order")
    list_filter = ("order",)


@admin.register(ShrineSubmission)
class ShrineSubmissionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "status",
        "name",
        "address",
        "user",
        "reviewed_by",
        "created_at",
    )
    list_filter = ("status", "created_at", "reviewed_at")
    search_fields = ("name", "address", "user__username", "user__email")
    ordering = ("-created_at",)
    readonly_fields = ("created_at", "updated_at", "reviewed_at")

    actions = ["mark_approved", "mark_rejected"]


    @admin.action(description="Mark as approved")
    def mark_approved(self, request, queryset):
        success_count = 0
        fail_count = 0

        for submission in queryset:
            try:
                approve_shrine_submission(
                    submission_id=submission.id,
                    reviewer=request.user,
                )
                success_count += 1
            except (ShrineSubmissionDuplicateError, ShrineSubmissionInvalidStateError) as exc:
                fail_count += 1
                self.message_user(
                    request,
                    f"id={submission.id} の承認に失敗: {exc}",
                    level=messages.WARNING,
                )

        if success_count:
            self.message_user(
                request,
                f"{success_count}件を承認し、Shrine へ反映しました。",
                level=messages.SUCCESS,
            )

        if fail_count:
            self.message_user(
                request,
                f"{fail_count}件は承認できませんでした。",
                level=messages.WARNING,
            )

    @admin.action(description="Mark as rejected")
    def mark_rejected(self, request, queryset):
        updated = queryset.update(
            status=ShrineSubmission.Status.REJECTED,
            reviewed_at=timezone.now(),
            reviewed_by=request.user,
        )
        self.message_user(
            request,
            f"{updated}件を rejected に更新しました。",
            level=messages.SUCCESS,
        )


def _maybe_register(model_name: str, admin_cls: type[admin.ModelAdmin]) -> None:
    """
    temples に model_name があれば Admin へ登録。
    無ければ静かにスキップ。既登録なら安全にスキップ。
    """
    try:
        Model = apps.get_model("temples", model_name, require_ready=False)
    except LookupError:
        return
    if Model is None:
        return
    try:
        admin.site.register(Model, admin_cls)
    except admin.sites.AlreadyRegistered:
        pass


class DeityAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "kana")
    search_fields = ("name", "kana", "aliases")


class GoriyakuTagAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "category")
    search_fields = ("name", "category")


class ShrineAdmin(admin.ModelAdmin):
    """神社モデルの管理画面（GISウィジェットなしの暫定版）"""
    list_display = ("name_jp", "address", "popular_score", "views_30d", "favorites_30d", "updated_at")
    search_fields = ("name_jp", "name_romaji", "address")
    list_filter = ("kind", "element", "kyusei")
    ordering = ("-popular_score", "-updated_at")
    readonly_fields = ("last_popular_calc_at",)
    filter_horizontal = ("goriyaku_tags",)


# ---- 動的登録（存在する時だけ）----
_maybe_register("Deity", DeityAdmin)
_maybe_register("GoriyakuTag", GoriyakuTagAdmin)
_maybe_register("Shrine", ShrineAdmin)
