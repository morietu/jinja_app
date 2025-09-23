from django.contrib import admin

try:
    from .models import UserProfile

    @admin.register(UserProfile)
    class UserProfileAdmin(admin.ModelAdmin):
        list_display = ("user", "nickname", "is_public", "created_at")

except Exception:
    # UserProfile が無いプロジェクトでも落ちないようにする
    pass
