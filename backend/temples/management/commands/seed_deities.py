import csv
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

from django.core.management.base import BaseCommand, CommandError
from temples.models import Deity, Shrine

# === 組み込みシード ===
DEITIES: List[Tuple[str, str, str]] = [
    ("大国主", "", "大国主命,大国主大神,大国様,大黒天"),
    ("木花咲耶姫", "このはなさくやひめ", "木花開耶姫,木花佐久夜毘売,コノハナサクヤヒメ"),
    ("観音菩薩", "かんのんぼさつ", "観音,観世音菩薩"),
    ("恵比寿", "えびす", "蛭子,夷,戎"),
    ("毘沙門天", "びしゃもんてん", "多聞天"),
    ("菅原道真", "すがわらのみちざね", "天神,天満宮"),
]

# shrine_name: (kyusei, [deities], kind)
# kind は "shrine" / "temple" / None を許容
LINKS: Dict[str, Tuple[str, List[str], Optional[str]]] = {
    "浅草寺(ダミー)": ("九紫火星", ["観音菩薩"], "temple"),
    "今戸神社(ダミー)": ("一白水星", ["大国主", "木花咲耶姫", "応神天皇", "福禄寿"], "shrine"),
    "待乳山聖天(ダミー)": ("六白金星", ["歓喜天"], "temple"),
}


class Command(BaseCommand):
    help = (
        "Seed deities and link them to shrines. "
        "If --csv is provided, import from CSV; otherwise use built-in seeds."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--csv",
            type=str,
            help="Path to CSV (headers: shrine_name,deity_name,kana,aliases,kyusei(kind optional),kind(optional))",
        )
        parser.add_argument(
            "--create-missing-shrines",
            action="store_true",
            help="Create Shrine if not found (name_jp only).",
        )

    # ---------- 共通ユーティリティ ----------
    def _upsert_deity(self, name: str, kana: str = "", aliases: str = "") -> Deity:
        d, _ = Deity.objects.get_or_create(name=name)
        changed = False
        if kana and not d.kana:
            d.kana = kana
            changed = True
        if aliases:
            if not d.aliases:
                d.aliases = aliases
                changed = True
            elif aliases not in d.aliases:
                d.aliases = d.aliases + "," + aliases
                changed = True
        if changed:
            d.save()
        return d

    # ---------- 組み込みモード ----------
    def _seed_builtin(self):
        name2obj = {
            name: self._upsert_deity(name, kana, aliases) for name, kana, aliases in DEITIES
        }
        self.stdout.write(self.style.SUCCESS(f"Deities upserted: {len(name2obj)}"))

        for sname, (kyusei, deity_names, kind) in LINKS.items():
            s = Shrine.objects.filter(name_jp=sname).first()
            if not s:
                self.stdout.write(self.style.WARNING(f"Shrine not found: {sname}"))
                continue

            updates = []
            if kyusei:
                s.kyusei = kyusei
                updates.append("kyusei")
            if kind:
                s.kind = kind
                updates.append("kind")
            if updates:
                s.save(update_fields=updates)

            objs = [name2obj.get(dn) or self._upsert_deity(dn) for dn in deity_names]
            s.deities.set(objs)
            self.stdout.write(
                self.style.SUCCESS(
                    f"Linked {sname}: kyusei={kyusei}, kind={kind or '-'}, deities={[d.name for d in objs]}"
                )
            )

        self.stdout.write(self.style.SUCCESS("Done (builtin)."))

    # ---------- CSV モード ----------
    def _read_csv(self, path: Path) -> Iterable[dict]:
        with path.open(newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                yield row

    def _seed_csv(self, path: Path, create_missing: bool):
        if not path.exists():
            raise CommandError(f"CSV not found: {path}")
        linked = 0
        for row in self._read_csv(path):
            sname = (row.get("shrine_name") or "").strip()
            dname = (row.get("deity_name") or "").strip()
            kana = (row.get("kana") or "").strip()
            aliases = (row.get("aliases") or "").strip()
            kyusei = (row.get("kyusei") or "").strip()
            kind = (row.get("kind") or "").strip().lower() or None  # shrine/temple/空

            if not sname or not dname:
                continue

            s = Shrine.objects.filter(name_jp=sname).first()
            if not s and create_missing:
                s = Shrine.objects.create(name_jp=sname, address="")
                self.stdout.write(self.style.WARNING(f"Created Shrine: {sname}"))
            if not s:
                self.stdout.write(self.style.WARNING(f"Skip (shrine not found): {sname}"))
                continue

            d = self._upsert_deity(dname, kana, aliases)
            s.deities.add(d)

            updates = []
            if kyusei:
                s.kyusei = kyusei
                updates.append("kyusei")
            if kind in ("shrine", "temple"):
                s.kind = kind
                updates.append("kind")
            if updates:
                s.save(update_fields=updates)

            linked += 1

        self.stdout.write(self.style.SUCCESS(f"Linked {linked} shrine-deity rows from CSV."))
        self.stdout.write(self.style.SUCCESS("Done (csv)."))

    # ---------- エントリポイント ----------
    def handle(self, *args, **opts):
        csv_path = opts.get("csv")
        if csv_path:
            self._seed_csv(Path(csv_path), create_missing=opts.get("create_missing_shrines"))
        else:
            self._seed_builtin()
