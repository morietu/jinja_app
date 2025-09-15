from django.contrib import admin
from .models import Shrine

@admin.register(Shrine)
class ShrineAdmin(admin.ModelAdmin):
    """
    モデルに name が無くても通る安全構成。
    """
    list_display = ("id", "display_name")
    ordering = ("id",)
    search_fields = ()  # 後で実在カラムに差し替え

    @admin.display(description="Name")
    def display_name(self, obj):
        # よくある候補を順に探す。無ければ __str__。
        for attr in ("name", "title", "shrine_name", "label"):
            if hasattr(obj, attr):
                return getattr(obj, attr)
        return str(obj)
