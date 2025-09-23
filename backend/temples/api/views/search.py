from django.db.models import Case, IntegerField, When
from django.http import JsonResponse

from temples.models import Shrine
from temples.services.recommendation import recommend_shrines


def search(request):
    qs = Shrine.objects.all()
    ids_scores = recommend_shrines(qs)  # [(id, score), ...] 既に降順
    id_order = [i for i, _ in ids_scores]
    score_map = dict(ids_scores)

    preserved = Case(
        *[When(id=pk, then=pos) for pos, pk in enumerate(id_order)], output_field=IntegerField()
    )
    qs = Shrine.objects.filter(id__in=id_order).order_by(preserved)

    results = [
        {"id": s.id, "name": s.name_jp, "score": float(score_map.get(s.id, 0.0))} for s in qs
    ]
    return JsonResponse({"results": results})
