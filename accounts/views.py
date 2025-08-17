from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from temples.models import Favorite

@login_required
def mypage(request):
    favorites = Favorite.objects.filter(user=request.user).select_related("shrine")
    shrines = [f.shrine for f in favorites]
    return render(request, "accounts/mypage.html", {"favorite_shrines": shrines})
