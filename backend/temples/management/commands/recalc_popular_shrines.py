# backend/temples/management/commands/recalc_popular_shrines.py
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Count
from django.utils import timezone
from temples.models import Favorite, Shrine  # Favorite に created_at が必要

W_VIEW = 1.0
W_FAV = 5.0


class Command(BaseCommand):
    help = "Recalculate popularity fields for shrines (last N days)."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=30)

    def handle(self, *args, **opts):
        days = opts["days"]
        since = timezone.now() - timedelta(days=days)

        # 30日のお気に入り数を shrine_id ごとに集計
        fav_map = dict(
            Favorite.objects.filter(created_at__gte=since)
            .values("shrine_id")
            .annotate(c=Count("id"))
            .values_list("shrine_id", "c")
        )

        updated = 0
        for s in Shrine.objects.only("id", "views_30d").iterator():
            f30 = fav_map.get(s.id, 0)
            v30 = s.views_30d  # MVPでは既存カウンタを採用（将来は閲覧ログで上書き）
            score = v30 * W_VIEW + f30 * W_FAV
            Shrine.objects.filter(id=s.id).update(
                favorites_30d=f30,
                popular_score=score,
                last_popular_calc_at=timezone.now(),
            )
            updated += 1

        self.stdout.write(self.style.SUCCESS(f"updated shrines: {updated}"))
