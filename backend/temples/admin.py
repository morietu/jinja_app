# backend/temples/admin.py
from django.contrib import admin
from .models import Shrine



@admin.register(Shrine)
class ShrineAdmin(admin.ModelAdmin):
    """
    神社モデルの管理画面
    """
    list_display = (
        "name_jp",
        "address",
        "popular_score",
        "views_30d",
        "favorites_30d",
        "updated_at",
    )
    search_fields = ("name_jp", "name_romaji", "address")
    list_filter = ("element",)
    ordering = ("-popular_score", "-updated_at")
    readonly_fields = ("last_popular_calc_at",)

    


# 他のモデルも同様に必要なら登録
admin.site.register(Favorite)
admin.site.register(Visit)
admin.site.register(Goshuin)
admin.site.register(ViewLike)
admin.site.register(RankingLog)