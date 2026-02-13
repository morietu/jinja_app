from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from temples.models import ShrineCandidate, PlaceRef
from rest_framework.response import Response
from rest_framework import status

from temples.services import places
from temples.api.serializers.places import PlaceLiteResponseSerializer
from temples.services.places import PlacesError, get_or_create_shrine_by_place_id

class PlacesResolveView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        q = (request.query_params.get("q") or "").strip()
        limit = int(request.query_params.get("limit") or 5)

        if not q or len(q) < 2:
            return Response({"results": []}, status=status.HTTP_200_OK)

        # ここは「候補を返すだけ」で ingest しない
        data = places.places_text_search({"query": q, "language": "ja", "region": "jp"})
        results = (data or {}).get("results") or []
        results = results[: max(1, min(limit, 10))]

        out = {"results": results}
        # serializer通したいならここで
        # PlaceLiteResponseSerializer(out).is_valid(raise_exception=True)
        return Response(out, status=status.HTTP_200_OK)

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

            # 同一 place_id の候補が複数ある場合は最新を対象にする
            c = ShrineCandidate.objects.filter(place_id=place_id).order_by("-created_at").first()
            if c:
                c.name_jp = c.name_jp or name_jp
                c.address = c.address or address
                c.lat = c.lat if c.lat is not None else lat
                c.lng = c.lng if c.lng is not None else lng
                c.synced_at = now

                # source は manual を守る。stub みたいなのだけ補正。
                if c.source in ("", None, "stub"):
                    c.source = ShrineCandidate.Source.RESOLVE

                # approved/rejected は壊さない。その他は「空ならAUTO」に寄せるだけ
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
            return Response(
                {
                    "id": shrine.id,
                    "shrine_id": shrine.id,
                    "place_id": place_id,
                    "candidate_id": c.id,
                },
                status=200,
            )
        except PlacesError as e:
            return Response({"detail": str(e)}, status=getattr(e, "status", 502) or 502)
        except IntegrityError as e:
            return Response({"detail": "db_integrity_error"}, status=500)
