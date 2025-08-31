from django.apps import AppConfig

class TemplesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "temples"
    verbose_name = "Temples"

    def ready(self):
        # signals を import してハンドラ登録
        from . import signals  # noqa: F401
