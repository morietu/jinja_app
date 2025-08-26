from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone

class User(AbstractUser):
    nickname = models.CharField(max_length=50, default="", blank=True)  # 表示名
    bio = models.TextField(blank=True, null=True)           # 自己紹介（将来用）
    icon = models.ImageField(upload_to="user_icons/", blank=True, null=True)  # アイコン
    is_public = models.BooleanField(default=True)           # 公開/非公開
    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.username or self.nickname
