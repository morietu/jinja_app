# temples/views/admin_seed.py
from io import StringIO

from django.core.management import call_command
from django.http import JsonResponse, HttpRequest
from django.views.decorators.http import require_http_methods


@require_http_methods(["POST", "GET"])
def seed_initial_shrine(request: HttpRequest):
    """
    本番DBに Shrine の初期データを投入する一時用エンドポイント。
    - temples/management/commands/create_initial_shrine.py を呼び出すだけ。
    - デプロイ後に 1 回叩いたら、URL/ビューごと削除する。
    """
    out = StringIO()
    try:
        call_command("create_initial_shrine", stdout=out)
        return JsonResponse(
            {
                "ok": True,
                "command": "create_initial_shrine",
                "output": out.getvalue(),
            }
        )
    except Exception as e:
        return JsonResponse(
            {
                "ok": False,
                "error": str(e),
            },
            status=500,
        )
