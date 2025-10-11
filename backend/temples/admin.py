# backend/temples/admin.py
from django.apps import apps
from django.contrib import admin


def _maybe_register(model_name: str, admin_cls: type[admin.ModelAdmin]) -> None:
    """
    temples アプリに model_name が存在する場合のみ Admin へ登録する。
    既に登録済みでも安全にスキップ。
    """
    Model = apps.get_model("temples", model_name)
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

    list_display = (
        "name_jp",
        "address",
        "popular_score",
        "views_30d",
        "favorites_30d",
        "updated_at",
    )
    search_fields = ("name_jp", "name_romaji", "address")
    list_filter = ("kind", "element", "kyusei")
    ordering = ("-popular_score", "-updated_at")
    readonly_fields = ("last_popular_calc_at",)
    filter_horizontal = ("goriyaku_tags", "deities")


# ---- 動的登録（存在する時だけ）----
_maybe_register("Deity", DeityAdmin)
_maybe_register("GoriyakuTag", GoriyakuTagAdmin)
_maybe_register("Shrine", ShrineAdmin)
