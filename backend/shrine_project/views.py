from django.http import JsonResponse, HttpResponse

def index(request):
    return JsonResponse({
        "name": "AI参拝ナビ API",
        "status": "ok",
        "docs": "/api/",  # APIエントリ
        "endpoints": {
            "concierge_chat": "/api/concierge/chat/",
            "shrines": "/api/shrines/",
            "favorites": "/api/favorites/",
        }
    })

def favicon(request):
    # 空のfaviconでブラウザの404を抑止
    return HttpResponse(b"", content_type="image/x-icon", status=200)
