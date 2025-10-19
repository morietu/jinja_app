import logging

from django.apps import AppConfig

logger = logging.getLogger(__name__)


class TemplesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "temples"
    verbose_name = "Temples"

    def ready(self):
        try:
            from . import signals  # noqa: F401
        except Exception as e:
            logger.warning("temples.signals not loaded: %s", e)
