import io
import json
from pathlib import Path

import pytest
from django.core.management import call_command

from temples.models import Shrine, ShrineDeity, ShrineHistory, ShrineKnowledgeSource
from temples.services import evidence_gate
from temples.services.knowledge_seed import parse_seed

SEED_PATH = (
    Path(__file__).resolve().parents[1]
    / "data"
    / "knowledge_seeds"
    / "wave0_batch_01_seed.json"
)
BASE_SEED_PATH = Path(__file__).resolve().parents[1] / "data" / "shrines_seed_clean.json"

TARGETS = [
    ("三輪神社", "愛知県名古屋市中区大須3-9-32"),
    ("大鳥大社", "大阪府堺市西区鳳北町1-1-2"),
    ("御岩神社", "茨城県日立市入四間町752"),
    ("烏森神社", "東京都港区新橋2-15-5"),
    ("榴岡天満宮", "宮城県仙台市宮城野区榴ケ岡105-3"),
]

EXPECTED_FACT_COUNTS = {
    "三輪神社": (2, 1),
    "大鳥大社": (2, 2),
    "御岩神社": (4, 2),
    "烏森神社": (3, 1),
    "榴岡天満宮": (1, 1),
}


def _load_seed():
    return parse_seed(json.loads(SEED_PATH.read_text(encoding="utf-8")))


def test_wave0_db01_seed_schema_counts_and_identities():
    seed = _load_seed()

    assert seed.errors == []
    assert seed.schema_version == "1.0"
    assert len(seed.sources) == 5
    assert len(seed.shrines) == 5
    assert sum(len(shrine.deities) for shrine in seed.shrines) == 12
    assert sum(len(shrine.histories) for shrine in seed.shrines) == 7

    identities = [(shrine.name_jp, shrine.address) for shrine in seed.shrines]
    assert identities == TARGETS
    assert len(identities) == len(set(identities))


def test_wave0_db01_shrine_refs_exist_in_base_seed():
    base_rows = json.loads(BASE_SEED_PATH.read_text(encoding="utf-8"))
    base_identities = {(row["name_jp"], row["address"]) for row in base_rows}

    assert len(base_rows) == 108
    assert all(identity in base_identities for identity in TARGETS)


def test_wave0_db01_source_keys_are_resolved_and_no_fact_is_source_less():
    seed = _load_seed()
    known_sources = set(seed.sources)

    for shrine in seed.shrines:
        for deity in shrine.deities:
            assert deity.source_keys, (shrine.name_jp, deity.display_name)
            assert set(deity.source_keys) <= known_sources
        for history in shrine.histories:
            assert history.source_keys, (shrine.name_jp, history.title)
            assert set(history.source_keys) <= known_sources


def test_wave0_db01_per_shrine_fact_counts_are_frozen():
    seed = _load_seed()
    by_name = {shrine.name_jp: shrine for shrine in seed.shrines}

    assert set(by_name) == set(EXPECTED_FACT_COUNTS)
    for name, (deity_count, history_count) in EXPECTED_FACT_COUNTS.items():
        assert len(by_name[name].deities) == deity_count
        assert len(by_name[name].histories) == history_count


def test_wave0_db01_no_within_shrine_fact_duplicates():
    seed = _load_seed()

    for shrine in seed.shrines:
        deity_names = [deity.display_name for deity in shrine.deities]
        assert len(deity_names) == len(set(deity_names)), shrine.name_jp

        history_keys = [(history.history_type, history.title) for history in shrine.histories]
        assert len(history_keys) == len(set(history_keys)), shrine.name_jp


def test_wave0_db01_all_facts_are_fact_ready_and_high_confidence():
    seed = _load_seed()

    for source in seed.sources.values():
        assert source.verification_status == "source_confirmed"
        assert source.confidence == "high"
        assert source.verified_at is not None

    for shrine in seed.shrines:
        for fact in [*shrine.deities, *shrine.histories]:
            assert fact.verification_status == "source_confirmed"
            assert fact.confidence == "high"
            assert fact.verified_at is not None


def test_wave0_db01_evidence_gate_accepts_all_seed_facts():
    seed = _load_seed()
    decisions = []

    for shrine in seed.shrines:
        for fact in [*shrine.deities, *shrine.histories]:
            source_statuses = [
                seed.sources[source_key].verification_status
                for source_key in fact.source_keys
            ]
            decisions.append(
                evidence_gate.decide_fact_usability(
                    verification_status=fact.verification_status,
                    confidence=fact.confidence,
                    source_verification_statuses=source_statuses,
                )
            )

    assert len(decisions) == 19
    assert all(decision.usable for decision in decisions)


def test_wave0_db01_human_review_boundaries_are_preserved():
    seed = _load_seed()
    by_name = {shrine.name_jp: shrine for shrine in seed.shrines}

    miwa = by_name["三輪神社"]
    assert [history.history_type for history in miwa.histories] == ["tradition"]

    ootori = by_name["大鳥大社"]
    assert {history.history_type for history in ootori.histories} == {
        "tradition",
        "historical_event",
    }

    oiwa = by_name["御岩神社"]
    assert [deity.display_name for deity in oiwa.deities] == [
        "国常立尊",
        "大国主命",
        "伊邪那岐尊",
        "伊邪那美尊",
    ]
    assert all("他二十二柱" not in deity.display_name for deity in oiwa.deities)
    ancient = next(
        history for history in oiwa.histories if history.history_type == "regional_context"
    )
    assert "創建時期不明" in ancient.period_text
    assert ancient.event_date is None

    karasumori = by_name["烏森神社"]
    assert [history.history_type for history in karasumori.histories] == ["tradition"]

    tsutsujigaoka = by_name["榴岡天満宮"]
    assert [history.history_type for history in tsutsujigaoka.histories] == [
        "historical_event"
    ]


@pytest.mark.django_db
def test_wave0_db01_import_is_idempotent_and_preserves_unrelated_knowledge():
    for name_jp, address in TARGETS:
        Shrine.objects.create(name_jp=name_jp, kind="shrine", address=address)

    unrelated = Shrine.objects.create(
        name_jp="既存Knowledge神社（W0-DB01無関係）",
        kind="shrine",
        address="東京都既存区10-10-10",
    )
    existing_source = ShrineKnowledgeSource.objects.create(
        source_type="shrine_official",
        title="既存公式Source（W0-DB01無関係）",
        url="https://existing-wave0-db01.example.jp/",
        verification_status="source_confirmed",
        verified_at="2026-01-01T00:00:00Z",
        confidence="high",
    )
    existing_deity = ShrineDeity.objects.create(
        shrine=unrelated,
        display_name="既存祭神（W0-DB01無関係）",
        role="primary",
        verification_status="source_confirmed",
        verified_at="2026-01-01T00:00:00Z",
        confidence="high",
    )
    existing_deity.sources.set([existing_source])
    existing_history = ShrineHistory.objects.create(
        shrine=unrelated,
        history_type="historical_event",
        title="既存沿革（W0-DB01無関係）",
        content="既存の沿革本文。",
        verification_status="source_confirmed",
        verified_at="2026-01-01T00:00:00Z",
        confidence="high",
    )
    existing_history.sources.set([existing_source])

    call_command("import_shrine_knowledge", str(SEED_PATH), stdout=io.StringIO())

    targets = Shrine.objects.filter(name_jp__in=[name for name, _ in TARGETS])
    assert ShrineKnowledgeSource.objects.count() == 6
    assert ShrineDeity.objects.filter(shrine__in=targets).count() == 12
    assert ShrineHistory.objects.filter(shrine__in=targets).count() == 7
    assert all(
        deity.sources.exists()
        for deity in ShrineDeity.objects.filter(shrine__in=targets)
    )
    assert all(
        history.sources.exists()
        for history in ShrineHistory.objects.filter(shrine__in=targets)
    )

    dry_run = io.StringIO()
    call_command("import_shrine_knowledge", str(SEED_PATH), "--dry-run", stdout=dry_run)
    output = dry_run.getvalue()
    assert "'source_REUSE_EXISTING': 5" in output
    assert "'deity_SKIP_EXISTS': 12" in output
    assert "'history_SKIP_EXISTS': 7" in output
    assert "CREATE" not in output

    existing_deity.refresh_from_db()
    existing_history.refresh_from_db()
    assert existing_deity.display_name == "既存祭神（W0-DB01無関係）"
    assert existing_history.content == "既存の沿革本文。"
    assert list(existing_deity.sources.all()) == [existing_source]
    assert list(existing_history.sources.all()) == [existing_source]
