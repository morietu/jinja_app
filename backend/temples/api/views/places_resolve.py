# backend/temples/api/views/places_resolve.py
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from temples.models import ShrineCandidate, PlaceRef
from rest_framework import status

from temples.services import places
from temples.api.serializers.places import PlaceLiteResponseSerializer
from temples.services.places import PlacesError, get_or_create_shrine_by_place_id
from django.db import IntegrityError
import re
from typing import Any, Dict, List, Tuple

# “親施設” と見なしやすいワード（必要なら増やす）
PARENT_HINTS = [
    "神社", "寺", "寺院", "大社", "宮", "天満宮", "稲荷", "八幡", "観音", "大寺",
]

# “サブ施設” としてよく付くワード（ノイズ源）
SUB_HINTS = [
    "神楽殿", "社務所", "授与所", "宝物殿", "参集殿", "祈祷殿", "客殿", "本殿", "拝殿",
    "手水舎", "鳥居", "楼門", "社殿", "舞殿",
]

STOP = {"", "　", " ", "\t", "\n"}

def _norm(s: str) -> str:
    # ゆるく正規化（半角全角まではやらない。最小実装）
    return re.sub(r"\s+", " ", (s or "").strip()).lower()

def _tokenize(q: str) -> List[str]:
    qn = _norm(q).replace("　", " ")
    toks = [t for t in qn.split(" ") if t and t not in STOP]
    return toks[:8]  # 暴走防止

def _is_parentish_token(t: str) -> bool:
    return any(h in t for h in PARENT_HINTS) or ("神社" in t) or ("寺" in t)

def _is_subish_token(t: str) -> bool:
    return any(h in t for h in SUB_HINTS)

def _count_contains(hay: str, needle: str) -> int:
    if not hay or not needle:
        return 0
    return 1 if needle in hay else 0

def _place_text(r: Dict[str, Any]) -> Tuple[str, str]:
    # places_text_search の shape に合わせる（name/address が来る想定）
    name = _norm(str(r.get("name") or ""))
    addr = _norm(str(r.get("address") or r.get("formatted_address") or ""))
    return name, addr

# --- 追加: 地名っぽいトークン判定（最小版） ---
# いかにも“地名”になりやすい終わり方。必要なら増やす。
PLACE_SUFFIXES = ("区", "市", "町", "村", "郡", "県", "都", "府", "駅", "丁目", "番", "号")

def _is_placeish_token(t: str) -> bool:
    if len(t) < 2:
        return False
    if _is_parentish_token(t) or _is_subish_token(t):
        return False
    return t.endswith(PLACE_SUFFIXES)

def _is_short_placeish_fallback(t: str) -> bool:
    # 2〜6文字の救済。ただし雑に広げない
    if not (2 <= len(t) <= 6):
        return False
    if _is_parentish_token(t) or _is_subish_token(t):
        return False
    if re.search(r"[a-z0-9]", t):
        return False
    if re.search(r"[-_/]", t):
        return False
    # ひらがなだけは地名に見えにくいので弾く（任意だが事故減る）
    if re.fullmatch(r"[ぁ-ん]+", t):
        return False
    return True

def score_place(q: str, r: Dict[str, Any], base_rank: int) -> int:
    """
    base_rank: Googleが返した順（0が最上位）
    返り値: 大きいほど上位
    """
    toks = _tokenize(q)
    if not toks:
        return 10_000 - base_rank

    name, addr = _place_text(r)
    score = 0

    # 1) Google順を薄く残す（同点のタイブレーク）
    score += (10_000 - base_rank)

    # 2) 一般一致: name強め / addr弱め
    for t in toks:
        score += 200 * _count_contains(name, t)
        score += 40 * _count_contains(addr, t)

        # 地名っぽいトークンは address に入ってたら追加で加点（軽く）
        if _is_placeish_token(t) or _is_short_placeish_fallback(t):
            score += 30 * _count_contains(addr, t)
        

    # 3) 親語が入ってるなら超加点（親施設を最優先にしたい）
    parent_toks = [t for t in toks if _is_parentish_token(t)]
    for t in parent_toks:
        score += 1200 * _count_contains(name, t)
        # 親語が住所に入ることもあるので薄く
        score += 80 * _count_contains(addr, t)

    # 4) サブ語は「親語ヒットしてる結果だけ」強くする（方針継続）
    sub_toks = [t for t in toks if _is_subish_token(t)]
    parent_hit = any(_count_contains(name, pt) for pt in parent_toks) if parent_toks else False

    for t in sub_toks:
        sub_hit_name = _count_contains(name, t)
        sub_hit_addr = _count_contains(addr, t)  # ✅ address も見る（ただし弱め）

        if parent_hit:
            # 親が当たってる結果だけ、サブをちゃんと評価
            score += 500 * sub_hit_name
            score += 120 * sub_hit_addr
        else:
            # 親が当たってない “神楽殿” はノイズ率高いので抑える
            score += 120 * sub_hit_name
            score += 30 * sub_hit_addr

        # 親語がクエリにあるのに、結果に親が居ないサブ一致は減点（事故防止）
        if parent_toks and (sub_hit_name or sub_hit_addr) and not parent_hit:
            score -= 300

    # 5) 単体ジェネリック名は沈める
    if name in {"神楽殿", "社務所", "授与所", "宝物殿", "参集殿"}:
        score -= 400

    return score

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

        toks = _tokenize(q)
        parent_toks = [t for t in toks if _is_parentish_token(t)]

        # ✅ “最上位が親っぽい”なら、全面ソートしない（副作用を抑える）
        top_name, top_addr = _place_text(results[0])
        top_is_parent = any(_count_contains(top_name, pt) for pt in parent_toks) if parent_toks else False

        scored = []
        for i, r in enumerate(results):
            try:
                s = score_place(q, r, base_rank=i)
            except Exception:
                s = 10_000 - i
            scored.append((s, i, r))

        if top_is_parent:
            # 先頭だけ “本当にベスト” が別なら差し替える。残りはGoogle順を尊重。
            best = max(scored, key=lambda x: (x[0], -x[1]))
            best_i = best[1]
            if best_i != 0:
                best_r = best[2]
                rest = [r for j, r in enumerate(results) if j != best_i]
                results = [best_r] + rest
            # best_i == 0 なら何もしない（Google順そのまま）
        else:
            # トップが親じゃないなら全面リランク（ここだけ攻める）
            scored.sort(key=lambda x: (x[0], -x[1]), reverse=True)
            results = [r for _, _, r in scored]

        results = results[: max(1, min(limit, 10))]

        def _normalize_result_for_api(r: Dict[str, Any]) -> Dict[str, Any]:
            addr = r.get("address") or r.get("formatted_address") or ""
            # Bで統一: 両方埋める
            return {**r, "address": addr, "formatted_address": addr}

        results = [_normalize_result_for_api(r) for r in results]
        return Response({"results": results}, status=status.HTTP_200_OK)

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
