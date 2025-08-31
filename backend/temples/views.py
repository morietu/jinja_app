import os
from django.http import HttpResponse, Http404
from django.shortcuts import render, get_object_or_404
from django.contrib.auth.decorators import login_required
from .models import Shrine

def shrine_list(request):
    # URL解決/逆引き用の最小実装
    return HttpResponse("ok")

@login_required
def shrine_detail(request, pk: int):
    shrine = get_object_or_404(Shrine, pk=pk)
    if shrine.owner_id != getattr(request.user, "id", None):
        raise Http404()
    return HttpResponse(f"detail {shrine.pk}")

@login_required
def shrine_route(request, pk: int):
    shrine = get_object_or_404(Shrine, pk=pk)
    if shrine.owner_id != getattr(request.user, "id", None):
        raise Http404()
    ctx = {
        "shrine": shrine,
        "GOOGLE_MAPS_API_KEY": os.environ.get("GOOGLE_MAPS_API_KEY", ""),
    }
    return render(request, "temples/route.html", ctx)

from django.contrib.auth.decorators import login_required
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from .models import Shrine

@login_required
def favorite_toggle(request, pk: int):
    # ここではURL解決用の最小応答だけ返す
    get_object_or_404(Shrine, pk=pk)
    return HttpResponse("ok")
