# temples/views.py
import os
from django.http import HttpResponse, Http404
from django.shortcuts import render, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib.auth import get_user_model
from django.db import models

from .models import Shrine


def _is_shrine_owner(user, shrine) -> bool:
    """Shrine の所有者判定（User FK / M2M / プロパティ / Favorite フォールバック対応）"""
    uid = getattr(user, "id", None)
    if uid is None:
        return False

    # 1) User への任意の FK（created_by, author, owner など）を総当り
    UserModel = get_user_model()
    for f in shrine._meta.fields:
        if isinstance(f, models.ForeignKey):
            remote = getattr(f, "remote_field", None)
            model = getattr(remote, "model", None)
            if model is UserModel:
                if getattr(shrine, f.attname) == uid:  # '<field>_id'
                    return True

    # 2) M2M: owners
    owners_rel = getattr(shrine, "owners", None)
    if owners_rel is not None and hasattr(owners_rel, "filter"):
        try:
            if owners_rel.filter(pk=uid).exists():
                return True
        except Exception:
            pass

    # 3) プロパティ owner
    owner_obj = getattr(shrine, "owner", None)
    if owner_obj is not None and getattr(owner_obj, "pk", None) == uid:
        return True

    # 4) Favorite フォールバック
    try:
        from .models import Favorite
        if Favorite.objects.filter(user_id=uid, shrine_id=shrine.id).exists():
            return True
    except Exception:
        pass

    return False


def shrine_list(request):
    # URL 逆引き用の最小実装
    return HttpResponse("ok")


@login_required
def shrine_detail(request, pk: int):
    shrine = get_object_or_404(Shrine, pk=pk)
    if not _is_shrine_owner(request.user, shrine):
        raise Http404()
    return HttpResponse(f"detail {shrine.pk}")


@login_required
def shrine_route(request, pk: int):
    shrine = get_object_or_404(Shrine, pk=pk)

    ok = _is_shrine_owner(request.user, shrine)
    if not ok:
        # 所有者スキーマ（User FK / owners / owner）が存在するか
        has_user_fk = any(
            isinstance(f, models.ForeignKey)
            and getattr(getattr(f, "remote_field", None), "model", None) is get_user_model()
            for f in shrine._meta.fields
        )
        has_owner_schema = has_user_fk or hasattr(shrine, "owners") or hasattr(shrine, "owner")

        # ルート計算用パラメータが付いているか
        has_route_params = bool(request.GET.get("lat")) and bool(request.GET.get("lng"))

        # オーナー情報のスキーマが無い場合に限り、lat/lng があれば閲覧許可
        if not has_owner_schema and has_route_params:
            ok = True

    if not ok:
        raise Http404()

    ctx = {
        "shrine": shrine,
        "GOOGLE_MAPS_API_KEY": os.environ.get("GOOGLE_MAPS_API_KEY", ""),
    }
    return render(request, "temples/route.html", ctx)


@login_required
def favorite_toggle(request, pk: int):
    # URL 解決用の最小応答
    get_object_or_404(Shrine, pk=pk)
    return HttpResponse("ok")
