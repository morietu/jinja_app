import logging

from django.apps import AppConfig

logger = logging.getLogger(__name__)


class TemplesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "temples"
    verbose_name = "Temples"

    def ready(self):
        # signals を import してハンドラ登録
        from . import signals  # noqa: F401

        logger.info("TemplesConfig.ready(): signals loaded")
