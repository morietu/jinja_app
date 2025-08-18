# temples/views.py
import os
import json

import os
import json

from django.db.models import Q, Exists, OuterRef
from django.shortcuts import render, get_object_or_404, redirect
from django.urls import reverse
from django.views.generic import ListView, DetailView

from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import HttpResponseBadRequest, JsonResponse

from .forms import ShrineSearchForm
from .models import Shrine, Favorite


def _is_admin(user):
    return user.is_staff or user.is_superuser

class ShrineListView(LoginRequiredMixin, ListView):          # ★ログイン必須
    model = Shrine
    template_name = "temples/list.html"
    context_object_name = "shrines"
    paginate_by = 12

    def get_queryset(self):
        user = self.request.user
        # ★自分の所有だけ（管理者は全件）
        qs = Shrine.objects.all() if _is_admin(user) else Shrine.objects.filter(owner=user)

        # ★ ログイン中は is_favorited を注入
        subq = Favorite.objects.filter(user=user, shrine_id=OuterRef("pk"))
        qs = qs.annotate(is_favorited=Exists(subq))

        self.form = ShrineSearchForm(self.request.GET or None)
        if self.form.is_valid():
            q = self.form.cleaned_data.get("q")
            pref = self.form.cleaned_data.get("pref")
            sort = self.form.cleaned_data.get("sort") or "name"
            lat = self.form.cleaned_data.get("lat")
            lng = self.form.cleaned_data.get("lng")
            fav_only = self.form.cleaned_data.get("fav")

            if q:
                qs = qs.filter(
                    Q(name__icontains=q)
                    | Q(address__icontains=q)
                    | Q(prefecture__icontains=q)
                    | Q(benefits__icontains=q)
                    | Q(enshrined_kami__icontains=q)
                )
            if pref:
                qs = qs.filter(prefecture=pref)

            if fav_only:
                qs = qs.filter(is_favorited=True)

            if sort == "built_year":
                qs = qs.order_by("built_year", "name")
            elif sort == "nearest" and lat is not None and lng is not None:
                items = list(qs.filter(lat__isnull=False, lng__isnull=False))
                items.sort(key=lambda s: _haversine(lat, lng, s.lat, s.lng))
                return items
            else:
                qs = qs.order_by("name")

        return qs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["form"] = getattr(self, "form", ShrineSearchForm())
        params = self.request.GET.copy()
        params.pop("page", None)
        ctx["querystring"] = params.urlencode()
        return ctx


class ShrineDetailView(LoginRequiredMixin, DetailView):      # ★ログイン必須
    model = Shrine
    template_name = "temples/detail.html"
    context_object_name = "shrine"

    # ★所有者以外は404（管理者は除外）
    def get_queryset(self):
        user = self.request.user
        return Shrine.objects.all() if _is_admin(user) else Shrine.objects.filter(owner=user)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        user = self.request.user
        ctx["is_favorited"] = Favorite.objects.filter(user=user, shrine=self.object).exists()
        ctx["favorite_count"] = self.object.favorited_by.count()
        return ctx


@login_required
def favorite_toggle(request, pk):
    if request.method != "POST":
        return HttpResponseBadRequest("Invalid method")

    # ★自分の神社に対してのみトグル（管理者は全件OK）
    if _is_admin(request.user):
        shrine = get_object_or_404(Shrine, pk=pk)
    else:
        shrine = get_object_or_404(Shrine, pk=pk, owner=request.user)

    fav, created = Favorite.objects.get_or_create(user=request.user, shrine=shrine)
    status = "added"
    if not created:
        fav.delete()
        status = "removed"

    if request.headers.get("x-requested-with") == "XMLHttpRequest":
        return JsonResponse({"status": status, "count": shrine.favorited_by.count()})

    next_url = (
        request.POST.get("next")
        or request.META.get("HTTP_REFERER")
        or reverse("temples:shrine_detail", args=[pk])   # ★namespace付きに修正
    )
    return redirect(next_url)


def _haversine(lat1, lon1, lat2, lon2):
    from math import radians, sin, cos, asin, sqrt
    R = 6371.0
    dlat = radians(lat2 - lat1); dlon = radians(lon2 - lon1)
    a = sin(dlat/2)**2 + cos(radians(lat1))*cos(radians(lat2))*sin(dlon/2)**2
    return 2 * R * asin(sqrt(a))


@login_required
def shrine_route(request, pk):
    # ★メインも候補も“自分の神社”に限定（管理者は全件OK）
    if _is_admin(request.user):
        main = get_object_or_404(Shrine, pk=pk)
        base_qs = Shrine.objects.exclude(pk=pk)
    else:
        main = get_object_or_404(Shrine, pk=pk, owner=request.user)
        base_qs = Shrine.objects.filter(owner=request.user).exclude(pk=pk)

    clat = float(request.GET.get("lat", main.lat or 0))
    clng = float(request.GET.get("lng", main.lng or 0))

    qs = base_qs.filter(prefecture=main.prefecture)
    candidates = []
    for s in qs:
        if s.lat is None or s.lng is None:
            continue
        d = _haversine(clat, clng, s.lat, s.lng)
        candidates.append((d, s))
    candidates.sort(key=lambda x: x[0])
    top = [s for _, s in candidates[:10]]

    ctx = {
        "current": {"lat": clat, "lng": clng},
        "main": main,
        "candidates_json": json.dumps(
            [{"lat": s.lat, "lng": s.lng, "name": s.name} for s in top],
            ensure_ascii=False,
        ),
        "GOOGLE_MAPS_API_KEY": os.getenv("GOOGLE_MAPS_API_KEY", ""),
    }
    return render(request, "temples/route.html", ctx)


修正する必要がある？