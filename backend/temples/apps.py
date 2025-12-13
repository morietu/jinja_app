# backend/temples/apps.py
import os
import logging


from django.apps import AppConfig

logger = logging.getLogger(__name__)


class TemplesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "temples"
    verbose_name = "Temples"

    def ready(self):
        # CI/テストでシグナルを読みたくない場合は環境変数で無効化
        if os.getenv("TEMPLES_LOAD_SIGNALS", "1") != "1":
            return

        from django.apps import apps
        from django.db.models.signals import pre_save, post_save

        from .signals import (
            auto_geocode_on_save,
            on_shrine_saved,
            fill_latlng_if_missing,
        )

        Shrine = apps.get_model("temples", "Shrine")

        post_save.connect(on_shrine_saved, sender=Shrine, dispatch_uid="temples.on_shrine_saved")
        pre_save.connect(auto_geocode_on_save, sender=Shrine, dispatch_uid="temples.auto_geocode_on_save")
        pre_save.connect(fill_latlng_if_missing, sender=Shrine, dispatch_uid="temples.fill_latlng_if_missing")
