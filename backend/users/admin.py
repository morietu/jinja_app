from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    """カスタムユーザー管理画面"""
    fieldsets = UserAdmin.fieldsets + (
        ("追加情報", {"fields": ("nickname",)}),
    )
