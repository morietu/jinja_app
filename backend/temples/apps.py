# backend/temples/apps.py
import os
import logging
from django.apps import AppConfig

logger = logging.getLogger(__name__)


def _start_candidate_scheduler() -> None:
    """
    dev用: 候補の自動取得ジョブを起動。
    - runserver の autoreload で2重起動するので RUN_MAIN=true のときだけ動かす
    - 失敗してもDjango起動を止めない
    """
    if os.getenv("AUTO_CANDIDATE_JOBS") != "1":
        return
    if os.environ.get("RUN_MAIN") != "true":
        return

    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from django.core.management import call_command

        scheduler = BackgroundScheduler(timezone="Asia/Tokyo")

        def job():
            call_command("fetch_shrine_candidates")

        scheduler.add_job(
            job,
            "interval",
            minutes=10,
            id="fetch_shrine_candidates",
            replace_existing=True,
        )
        scheduler.start()
        logger.info("APScheduler started (AUTO_CANDIDATE_JOBS=1)")
    except Exception:
        logger.exception("Failed to start APScheduler")


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

        # dev: auto candidate jobs
        _start_candidate_scheduler()
