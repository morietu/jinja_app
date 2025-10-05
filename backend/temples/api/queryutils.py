# temples/api/queryutils.py
from django.db.models import BooleanField, Exists, OuterRef, Value
from temples.models import Favorite


def annotate_is_favorite(qs, request):
    user = getattr(request, "user", None)
    if user and getattr(user, "is_authenticated", False):
        fav_subq = Favorite.objects.filter(user=user, shrine=OuterRef("pk"))
        return qs.annotate(is_favorite=Exists(fav_subq))
    # 未ログイン時は False を固定注釈
    return qs.annotate(is_favorite=Value(False, output_field=BooleanField()))
