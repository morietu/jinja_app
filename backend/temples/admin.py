# backend/temples/admin.py
from django.contrib import admin
from .models import Shrine


@admin.register(GoriyakuTag)
class GoriyakuTagAdmin(admin.ModelAdmin):
    list_display = ("id", "name")
    search_fields = ("name",)

@admin.register(Shrine)
class ShrineAdmin(admin.ModelAdmin):
    """
    神社モデルの管理画面
    - 位置情報は地図ウィジェットで編集
    - 人気集計は参照のみ（再計算は管理コマンド）
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

    # OSMGeoAdmin の地図初期表示（任意）
    default_lon = 139.767052 * 10000000  # 東京駅あたり（OSMGeoAdminは乗算が必要）
    default_lat = 35.681167 * 10000000
    default_zoom = 5


# 他のモデルも同様に必要なら登録
admin.site.register(Favorite)
admin.site.register(Visit)
admin.site.register(Goshuin)
admin.site.register(ViewLike)
admin.site.register(RankingLog)