# backend/temples/admin.py
from django.apps import apps
from django.contrib import admin
from .models import Goshuin, GoshuinImage

@admin.register(Goshuin)
class GoshuinAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "shrine", "title", "is_public", "created_at")
    list_filter = ("is_public", "created_at")
    search_fields = ("title", "user__username", "shrine__name_jp")

@admin.register(GoshuinImage)
class GoshuinImageAdmin(admin.ModelAdmin):
    list_display = ("id", "goshuin", "order")
    list_filter = ("order",)
    

def _maybe_register(model_name: str, admin_cls: type[admin.ModelAdmin]) -> None:
    """
    temples に model_name があれば Admin へ登録。
    無ければ静かにスキップ。既登録なら安全にスキップ。
    """
    try:
        # モデル未定義でもここで例外にせず握りつぶす
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
