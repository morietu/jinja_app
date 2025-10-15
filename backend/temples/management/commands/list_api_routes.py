from django.core.management.base import BaseCommand
from django.urls import URLPattern, URLResolver, get_resolver


def walk(patterns, prefix=""):
    for p in patterns:
        if isinstance(p, URLPattern):
            callback = p.callback
            # DRF の ViewSet 経由でも method 候補をできるだけ拾う
            methods = None
            cls = getattr(callback, "cls", None)
            if cls and hasattr(cls, "http_method_names"):
                methods = sorted(m for m in cls.http_method_names if m != "options")

            yield {
                "path": prefix + str(p.pattern),
                "name": p.name,
                "callback": f"{callback.__module__}.{getattr(callback, '__name__', 'view')}",
                "methods": methods,
            }
        elif isinstance(p, URLResolver):
            yield from walk(p.url_patterns, prefix + str(p.pattern))


class Command(BaseCommand):
    help = "List all API routes"

    def handle(self, *args, **kwargs):
        resolver = get_resolver()
        rows = [r for r in walk(resolver.url_patterns) if str(r["path"]).startswith("api/")]
        rows.sort(key=lambda r: r["path"])
        for r in rows:
            methods = ",".join(r["methods"]) if r["methods"] else ""
            self.stdout.write(f"{r['path']:<50}  {methods:<20}  {r['name'] or ''}  {r['callback']}")
