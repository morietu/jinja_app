# users/signals.py
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from .models import UserProfile


def _delete_file(f):
    try:
        if f and f.storage.exists(f.name):
            f.storage.delete(f.name)
    except Exception:
        pass


@receiver(post_delete, sender=UserProfile)
def _cleanup_deleted_profile(sender, instance, **kwargs):
    _delete_file(instance.icon)


@receiver(pre_save, sender=UserProfile)
def _stash_old_icon(sender, instance, **kwargs):
    if not instance.pk:
        instance._old_icon = None
        return
    try:
        old = UserProfile.objects.get(pk=instance.pk)
        instance._old_icon = old.icon if old.icon != instance.icon else None
    except UserProfile.DoesNotExist:
        instance._old_icon = None


@receiver(post_save, sender=UserProfile)
def _delete_replaced_icon(sender, instance, **kwargs):
    if getattr(instance, "_old_icon", None):
        _delete_file(instance._old_icon)
        instance._old_icon = None
