import os
import sys
import traceback

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "shrine_project.settings")

try:
    import django

    django.setup()
    from django.urls import get_resolver, reverse

    print("resolver app_dict keys:", list(get_resolver().app_dict.keys()))
    print("has 'temples' namespace:", "temples" in get_resolver().app_dict)
    print("reverse:", reverse("temples:shrine_list"))
except Exception:
    print("ERROR")
    traceback.print_exc()
    sys.exit(1)
