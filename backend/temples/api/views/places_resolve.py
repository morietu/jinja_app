# backend/temples/api/views/places_resolve.py
# backend/temples/api/views/places_resolve.py
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from django.utils import timezone
from django.db import IntegrityError
from typing import Any, Dict

from temples.models import ShrineCandidate, PlaceRef
from temples.services import places
from temples.services import places_rank as rank
from temples.services.places import PlacesError, get_or_create_shrine_by_place_id


class PlacesResolveView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        q = (request.query_params.get("q") or "").strip()
        limit = int(request.query_params.get("limit") or 5)

        if not q or len(q) < 2:
            return Response({"results": []}, status=status.HTTP_200_OK)

        data = places.places_text_search({"query": q, "language": "ja", "region": "jp"})
        results = (data or {}).get("results") or []
        if not results:
            return Response({"results": []}, status=status.HTTP_200_OK)

        toks = rank.tokenize(q)
        parent_toks = [t for t in toks if rank.is_parentish_token(t)]

        top_name, _ = rank.place_text(results[0])
        top_is_parent = any(rank.count_contains(top_name, pt) for pt in parent_toks) if parent_toks else False

        scored = []
        for i, r in enumerate(results):
            try:
                s = rank.score_place(q, r, base_rank=i)
            except Exception:
                s = 10_000 - i
            scored.append((s, i, r))

        if top_is_parent:
            best = max(scored, key=lambda x: (x[0], -x[1]))
            best_i = best[1]
            if best_i != 0:
                best_r = best[2]
                rest = [r for j, r in enumerate(results) if j != best_i]
                results = [best_r] + rest
        else:
            scored.sort(key=lambda x: (x[0], -x[1]), reverse=True)
            results = [r for _, _, r in scored]

        results = results[: max(1, min(limit, 10))]

        def _normalize_result_for_api(r: Dict[str, Any]) -> Dict[str, Any]:
            addr = r.get("address") or r.get("formatted_address") or ""
            return {**r, "address": addr, "formatted_address": addr}

        return Response({"results": [_normalize_result_for_api(r) for r in results]}, status=status.HTTP_200_OK)



    def post(self, request):
        place_id = (request.data or {}).get("place_id")
        if not place_id:
            return Response({"detail": "place_id is required"}, status=400)

        try:
            shrine = get_or_create_shrine_by_place_id(place_id)

            pr = shrine.place_ref or PlaceRef.objects.filter(pk=place_id).first()
            name_jp = (pr.name if pr else "") or shrine.name_jp or ""
            address = (pr.address if pr else "") or shrine.address or ""
            lat = (pr.latitude if pr else None) or shrine.latitude
            lng = (pr.longitude if pr else None) or shrine.longitude

            now = timezone.now()
            c = ShrineCandidate.objects.filter(place_id=place_id).order_by("-created_at").first()
            if c:
                c.name_jp = c.name_jp or name_jp
                c.address = c.address or address
                c.lat = c.lat if c.lat is not None else lat
                c.lng = c.lng if c.lng is not None else lng
                c.synced_at = now

                if c.source in ("", None, "stub"):
                    c.source = ShrineCandidate.Source.RESOLVE

                if c.status not in (ShrineCandidate.Status.APPROVED, ShrineCandidate.Status.REJECTED):
                    c.status = c.status or ShrineCandidate.Status.AUTO

                c.save(update_fields=["name_jp","address","lat","lng","synced_at","source","status"])
            else:
                c = ShrineCandidate.objects.create(
                    place_id=place_id,
                    name_jp=name_jp,
                    address=address,
                    lat=lat,
                    lng=lng,
                    goriyaku="",
                    source=ShrineCandidate.Source.RESOLVE,
                    status=ShrineCandidate.Status.AUTO,
                    raw={"place_id": place_id, "shrine_id": shrine.id, "via": "resolve"},
                    synced_at=now,
                )

            return Response({"id": shrine.id, "shrine_id": shrine.id, "place_id": place_id, "candidate_id": c.id}, status=200)

        except PlacesError as e:
            return Response({"detail": str(e)}, status=getattr(e, "status", 502) or 502)
        except IntegrityError:
            return Response({"detail": "db_integrity_error"}, status=500)
