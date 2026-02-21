# backend/temples/management/commands/sync_places_seeds.py
from __future__ import annotations
import datetime
import json
import logging
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Tuple

from django.core.management.base import BaseCommand
from django.db.models import F
from django.utils import timezone

from temples.models_places_seeds import PlacesSeed, PlacesSeedState
from temples.services.places_sync import sync_nearby_seed
from django.db import transaction

logger = logging.getLogger(__name__)


@dataclass
class Defaults:
    radius_m: int = 2000
    limit: int = 20
    keyword: str = "神社"


def _now():
    return timezone.now()


def _parse_seeds_json(path: Path) -> Tuple[Defaults, List[Dict[str, Any]]]:
    """
    2形式を吸収:
    1) {"version":"v1","default":{...},"seeds":[{pref,label,name,lat,lng,...}]}
    2) [{"seed_key":"JP-13-capital","pref_code":"13","label":"東京都庁","lat":..,"lng":..}, ...]
    """
    raw = json.loads(path.read_text(encoding="utf-8"))

    # format 1
    if isinstance(raw, dict) and "seeds" in raw:
        d = raw.get("default") or {}
        defaults = Defaults(
            radius_m=int(d.get("radius_m", 2000)),
            limit=int(d.get("limit", 20)),
            keyword=str(d.get("keyword", "神社")),
        )
        seeds = raw.get("seeds") or []
        if not isinstance(seeds, list):
            seeds = []
        # seed_keyが無い場合は作る（pref/nameから生成）
        norm = []
        for i, s in enumerate(seeds):
            if not isinstance(s, dict):
                continue
            pref = str(s.get("pref", "")).strip()
            label = str(s.get("label", "")).strip() or "seed"
            pref_code = str(s.get("pref_code", "")).strip()
            name = str(s.get("name", "")).strip() or str(s.get("label", "")).strip()
            lat = s.get("lat")
            lng = s.get("lng")
            seed_key = str(s.get("seed_key", "")).strip()
            if not seed_key:
                # 雑にでも一意っぽく（pref_code優先）
                head = f"JP-{pref_code}" if pref_code else (pref[:2] or "JP")
                seed_key = f"{head}-{label}-{i:03d}"
            norm.append(
                {
                    "seed_key": seed_key,
                    "pref": pref,
                    "pref_code": pref_code,
                    "label": label,
                    "name": name,
                    "lat": lat,
                    "lng": lng,
                    "radius_m": s.get("radius_m"),
                    "limit": s.get("limit"),
                    "keyword": s.get("keyword"),
                }
            )
        return defaults, norm

    # format 2
    if isinstance(raw, list):
        defaults = Defaults()
        norm = []
        for s in raw:
            if not isinstance(s, dict):
                continue
            norm.append(
                {
                    "seed_key": str(s.get("seed_key", "")).strip(),
                    "pref": str(s.get("pref", "")).strip(),
                    "pref_code": str(s.get("pref_code", "")).strip(),
                    "label": str(s.get("label", "")).strip(),
                    "name": str(s.get("name", "")).strip() or str(s.get("label", "")).strip(),
                    "lat": s.get("lat"),
                    "lng": s.get("lng"),
                    "radius_m": s.get("radius_m"),
                    "limit": s.get("limit"),
                    "keyword": s.get("keyword"),
                }
            )
        # seed_key 必須
        norm = [x for x in norm if x.get("seed_key")]
        return defaults, norm

    return Defaults(), []


@transaction.atomic
def _upsert_seed_rows(seeds: List[Dict[str, Any]]) -> int:
    """
    seeds json をDBへ upsert。
    seed_key が主キーなので update_or_create でOK。
    """
    upserted = 0
    for i, s in enumerate(seeds):
        seed_key = (s.get("seed_key") or "").strip()
        if not seed_key:
            logger.warning("[sync_places_seeds] skip row index=%s reason=missing_seed_key", i)
            continue

        try:
            lat = float(s.get("lat"))
            lng = float(s.get("lng"))
        except (TypeError, ValueError):
            logger.warning(
                "[sync_places_seeds] skip row seed_key=%s index=%s reason=invalid_lat_lng lat=%r lng=%r",
                seed_key,
                i,
                s.get("lat"),
                s.get("lng"),
            )
            continue

        defaults = dict(
            pref=s.get("pref", "") or "",
            pref_code=s.get("pref_code", "") or "",
            label=s.get("label", "") or "",
            name=s.get("name", "") or "",
            lat=lat,
            lng=lng,
            radius_m=s.get("radius_m"),
            limit=s.get("limit"),
            keyword=(s.get("keyword") or ""),
            is_active=True,
        )
        seed_obj, _ = PlacesSeed.objects.update_or_create(seed_key=seed_key, defaults=defaults)
        PlacesSeedState.objects.get_or_create(seed=seed_obj)
        upserted += 1
    return upserted


def _eligible(
    seed: PlacesSeed,
    st: PlacesSeedState,
    *,
    since_hours: int,
    cooldown_hours: int,
) -> Tuple[bool, str]:
    """
    実行対象かどうか。理由も返す（ログが気持ちよくなる）。
    """
    if not seed.is_active:
        return False, "inactive"

    now = _now()

    # cooldown
    if st.cooldown_until and st.cooldown_until > now:
        return False, "cooldown"

    # since-hours: 最近回したseedは飛ばす
    if since_hours > 0 and st.last_run_at:
        age = now - st.last_run_at
        if age.total_seconds() < since_hours * 3600:
            return False, "recent"

    return True, "ok"


class Command(BaseCommand):
    help = "Sync Google Places nearby for seed points and upsert PlaceRef (state tracked in DB)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--path",
            default="backend/temples/data/places_seeds_jp_v1.json",
            help="Path to seeds json file",
        )
        parser.add_argument("--max-seeds", type=int, default=20, help="Max seeds to process in this run")
        parser.add_argument("--budget-requests", type=int, default=20, help="Hard cap for external requests used")
        parser.add_argument("--since-hours", type=int, default=24, help="Skip seeds ran within N hours")
        parser.add_argument("--cooldown-hours", type=int, default=6, help="Cooldown for failed seeds (hours)")
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--store-cache", action="store_true", help="Also upsert PlaceCache raw snapshots")
        parser.add_argument("--shuffle", action="store_true", help="Shuffle eligible seeds")
        parser.add_argument("--pref-code", default="", help="Filter by pref_code (e.g. 13)")

        # override defaults (file default > these)
        parser.add_argument("--radius-m", type=int, default=0, help="Override radius_m (0=use file/default)")
        parser.add_argument("--limit", type=int, default=0, help="Override limit (0=use file/default)")
        parser.add_argument("--keyword", default="", help="Override keyword (empty=use file/default)")

    def handle(self, *args, **opts):
        path = Path(opts["path"]).resolve()
        if not path.exists():
            raise SystemExit(f"Seeds file not found: {path}")

        defaults, seeds_raw = _parse_seeds_json(path)
        if not seeds_raw:
            self.stdout.write(self.style.WARNING("No seeds found in json."))
            return

        # DBへ seed upsert（stateも作る）
        seeds_upserted = _upsert_seed_rows(seeds_raw)
        self.stdout.write(f"[sync_places_seeds] seeds_upserted={seeds_upserted} file={path.name}")

        # 実行対象 seed を取得
        qs = PlacesSeed.objects.select_related("state").filter(is_active=True)
        pref_code = (opts.get("pref_code") or "").strip()
        if pref_code:
            qs = qs.filter(pref_code=pref_code)

        seeds = list(qs)

        # eligible filter
        eligible: List[PlacesSeed] = []
        skipped = {"inactive": 0, "cooldown": 0, "recent": 0}

        since_hours = int(opts["since_hours"])
        cooldown_hours = int(opts["cooldown_hours"])

        for s in seeds:
            st = getattr(s, "state", None)
            if not st:
                st = PlacesSeedState.objects.create(seed=s)

            ok, reason = _eligible(s, st, since_hours=since_hours, cooldown_hours=cooldown_hours)
            if ok:
                eligible.append(s)
            else:
                skipped[reason] = skipped.get(reason, 0) + 1

        if opts["shuffle"]:
            random.shuffle(eligible)
        else:
            # “偏りにくい”順: pref_code, label, last_run_at 古い順
            def _sort_key(seed: PlacesSeed):
                st = seed.state
                last = st.last_run_at or timezone.make_aware(datetime.datetime(1970, 1, 1))
                return (seed.pref_code, seed.label, last)
            eligible.sort(key=_sort_key)

        max_seeds = max(0, int(opts["max_seeds"]))
        eligible = eligible[:max_seeds]

        if not eligible:
            self.stdout.write(self.style.WARNING(f"[sync_places_seeds] nothing to run. skipped={skipped}"))
            return

        # 実行
        budget = max(0, int(opts["budget_requests"]))
        used = 0
        processed = 0
        total_upserted = 0
        total_fetched = 0
        total_errors = 0

        # override params
        override_radius = int(opts["radius_m"]) if int(opts["radius_m"]) > 0 else None
        override_limit = int(opts["limit"]) if int(opts["limit"]) > 0 else None
        override_keyword = (opts["keyword"] or "").strip() or None

        dry_run = bool(opts["dry_run"])
        store_cache = bool(opts["store_cache"])

        for seed in eligible:
            if used >= budget:
                self.stdout.write(self.style.WARNING(f"[sync_places_seeds] budget reached used={used}/{budget}"))
                break

            st = seed.state
            # mark running
            PlacesSeedState.objects.filter(seed=seed).update(
                last_status=PlacesSeedState.Status.RUNNING,
                last_error="",
                updated_at=_now(),
            )

            radius_m = override_radius or seed.radius_m or defaults.radius_m
            limit = override_limit or seed.limit or defaults.limit
            keyword = override_keyword or (seed.keyword or defaults.keyword)

            try:
                r = sync_nearby_seed(
                    seed.lat,
                    seed.lng,
                    radius_m=radius_m,
                    keyword=keyword,
                    limit=limit,
                    dry_run=dry_run,
                    store_cache=store_cache,
                )
            except Exception as e:
                # state: failed + cooldown
                cooldown_until = _now() + datetime.timedelta(hours=cooldown_hours)
                PlacesSeedState.objects.filter(seed=seed).update(
                    last_run_at=_now(),
                    last_status=PlacesSeedState.Status.FAILED,
                    last_error=str(e)[:4000],
                    cooldown_until=cooldown_until,
                    last_requests_used=0,
                    last_upserted=0,
                    last_fetched=0,
                    total_runs=F("total_runs") + 1,
                )
                total_errors += 1
                continue

            req_used = int(r.get("requests_used", 0))
            upserted = int(r.get("upserted", 0))
            fetched = int(r.get("fetched", 0))
            errs = r.get("errors") or []
            err_count = len(errs) if isinstance(errs, list) else 0

            used += req_used
            total_upserted += upserted
            total_fetched += fetched
            total_errors += err_count

            status = PlacesSeedState.Status.OK if err_count == 0 else PlacesSeedState.Status.FAILED
            cooldown_until = None
            last_error = ""
            if status == PlacesSeedState.Status.FAILED:
                cooldown_until = _now() + datetime.timedelta(hours=cooldown_hours)
                # 1件だけ雑に詰める（詳細はログへ）
                if err_count:
                    last_error = str(errs[0])[:4000]

            # state update
            PlacesSeedState.objects.filter(seed=seed).update(
                last_run_at=_now(),
                last_status=status,
                last_error=last_error,
                cooldown_until=cooldown_until,
                last_requests_used=req_used,
                last_upserted=upserted,
                last_fetched=fetched,
                total_runs=F("total_runs") + 1,
                total_requests_used=F("total_requests_used") + req_used,
                total_upserted=F("total_upserted") + upserted,
            )
            processed += 1

            self.stdout.write(
                f"[seed] {seed.seed_key} {seed.name} req={req_used} fetched={fetched} upserted={upserted} err={err_count}"
            )

            if used >= budget:
                self.stdout.write(self.style.WARNING(
                    f"[sync_places_seeds] budget reached used={used}/{budget} (after seed)"
                ))
                break

        self.stdout.write(
            self.style.SUCCESS(
                f"[sync_places_seeds] done used={used}/{budget} seeds={processed} "
                f"upserted={total_upserted} fetched={total_fetched} errors={total_errors} dry_run={dry_run}"
            )
        )
