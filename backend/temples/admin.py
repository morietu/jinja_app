# backend/temples/admin.py
from django.contrib import admin
from .models import Shrine, GoriyakuTag, Favorite, Visit, Goshuin, ViewLike, RankingLog


@admin.register(GoriyakuTag)
class GoriyakuTagAdmin(admin.ModelAdmin):
    list_display = ("id", "name")
    search_fields = ("name",)

@admin.register(Shrine)
class ShrineAdmin(admin.ModelAdmin):
    list_display = ("id", "name_jp", "address")
    search_fields = ("name_jp", "address")
    list_filter = ("goriyaku_tags",)


# 他のモデルも同様に必要なら登録
admin.site.register(Favorite)
admin.site.register(Visit)
admin.site.register(Goshuin)
admin.site.register(ViewLike)
admin.site.register(RankingLog)