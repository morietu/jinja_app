# backend/temples/apps.py
import logging
import os

from django.apps import AppConfig

logger = logging.getLogger(__name__)


class TemplesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "temples"
    verbose_name = "Temples"

    def ready(self):
        # CI/テストでシグナルを読みたくない場合は環境変数で無効化
        if os.getenv("TEMPLES_LOAD_SIGNALS", "1") != "1":
            logger.info("temples.signals loading is disabled by TEMPLES_LOAD_SIGNALS=0")
            return

        try:
            from . import signals  # noqa: F401
        except ImportError as e:
            # モジュール未配置など「想定内」の失敗のみ握る
            logger.warning("temples.signals not loaded (ImportError): %s", e)
        else:
            logger.debug("temples.signals loaded")
