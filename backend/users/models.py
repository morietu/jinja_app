from django.conf import settings
from django.db import models


class UserProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    nickname = models.CharField(max_length=64, blank=True, default="")
    is_public = models.BooleanField(default=True)
    bio = models.TextField(blank=True, null=True)
    icon = models.ImageField(upload_to="icons/", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.nickname or self.user.get_username()
