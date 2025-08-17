from django.contrib import admin
from .models import Shrine
from .models import Favorite

@admin.register(Shrine)
class ShrineAdmin(admin.ModelAdmin):
    list_display = ("name", "prefecture", "built_year")
    search_fields = ("name", "prefecture", "benefits", "enshrined_kami", "address")

@admin.register(Favorite)
class FavoriteAdmin(admin.ModelAdmin):
    list_display = ("user", "shrine", "created_at")
    search_fields = ("user__username", "shrine__name")
