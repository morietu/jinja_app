# users/apps.py
from django.apps import AppConfig


class UsersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "users"

    def ready(self):
        import users.signals  # 画像クリーンアップ等のシグナル

        from django.contrib.auth import get_user_model
        from django.db.models.signals import post_save
        from .models import UserProfile

        User = get_user_model()

        def ensure_profile(sender, instance, created, **kwargs):
            if created:
                UserProfile.objects.get_or_create(
                    user=instance,
                    defaults={"nickname": instance.get_username(), "is_public": True},
                )

        post_save.connect(
            ensure_profile,
            sender=User,
            dispatch_uid="users.ensure_profile",  # ← 重複防止
            weak=False,  # ← GC対策
        )
