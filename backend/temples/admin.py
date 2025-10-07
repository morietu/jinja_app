from django.contrib import admin

from .models import Deity, GoriyakuTag, Shrine


@admin.register(Deity)
class DeityAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "kana")
    search_fields = ("name", "kana", "aliases")


@admin.register(GoriyakuTag)
class GoriyakuTagAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "category")
    search_fields = ("name", "category")


@admin.register(Shrine)
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
    list_filter = ("kind", "element", "kyusei")  # ← kind/kyuseiもフィルタ可能に
    ordering = ("-popular_score", "-updated_at")
    readonly_fields = ("last_popular_calc_at",)

    # 👇 ここを追加（多対多の選択 UI を使いやすく）
    filter_horizontal = ("goriyaku_tags", "deities")
