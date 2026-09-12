import json
from collections import Counter
from pathlib import Path


MASTER_PATH = (
    Path(__file__).resolve().parents[2]
    / "temples"
    / "data"
    / "shrine_expansion_candidate_master.json"
)

EXPECTED_STATUS_COUNTS = {
    "BUILD_READY": 35,
    "HOLD": 8,
    "REVIEW": 1,
}

EXPECTED_REASON_COUNTS = {
    "WAVE0_CORE_READY_CANDIDATE": 35,
    "HOLD_MAPPING": 2,
    "SOURCE_HOLD": 3,
    "UNKNOWN_EVIDENCE": 3,
    "ENTITY_GRANULARITY_REVIEW": 1,
}

EXPECTED_HOLD_BY_REASON = {
    "HOLD_MAPPING": {"姫嶋神社", "行田八幡神社"},
    "SOURCE_HOLD": {"若宮八幡社", "富知六所浅間神社", "若宮神明社"},
    "UNKNOWN_EVIDENCE": {"居多神社", "唐澤山神社", "一之宮貫前神社"},
}

EXPECTED_REVIEW = {"諏訪大社 下社秋宮"}

# W0-B03 Namespace Reconciliation。
# Data Build Batch の canonical namespace は `W0-DB01`〜`W0-DB07`。
# 旧 `W0-B01`〜`W0-B07` は Wave0 の**工程ID**（W0-B01 = Base Shrine Seed Build /
# W0-B02 = Production Reconciliation）と衝突していたため、Data Build Batch 側だけを
# 改名した。工程ID は変更していない。
CANONICAL_BUILD_BATCHES = tuple(f"W0-DB0{n}" for n in range(1, 8))
LEGACY_BUILD_BATCHES = tuple(f"W0-B0{n}" for n in range(1, 8))

EXPECTED_BUILD_BATCH_COUNTS = {batch: 5 for batch in CANONICAL_BUILD_BATCHES}

# 次の Data Build target。member set を exact に固定する。
EXPECTED_W0_DB01_MEMBERS = {
    "三輪神社",
    "大鳥大社",
    "御岩神社",
    "烏森神社",
    "榴岡天満宮",
}

REQUIRED_W0_DB01_HYDRATION_FIELDS = {
    "official_name",
    "official_address",
    "official_source_type",
    "official_source_url",
    "verified_at",
    "latitude",
    "longitude",
    "goriyaku",
    "goriyaku_tags",
}

EXPECTED_W0_DB01_HYDRATION = {
    "三輪神社": {
        "official_name": "三輪神社",
        "official_address": "愛知県名古屋市中区大須3-9-32",
        "official_source_type": "shrine_official",
        "official_source_url": "https://miwajinnjya.com/guide/miwa-yuisyo/",
        "verified_at": "2026-09-12",
        "latitude": 35.1608797,
        "longitude": 136.9054313,
        "goriyaku": "厄除け",
        "goriyaku_tags": ["厄除け"],
    },
    "大鳥大社": {
        "official_name": "大鳥大社",
        "official_address": "大阪府堺市西区鳳北町1-1-2",
        "official_source_type": "shrine_official",
        "official_source_url": "https://www.ootoritaisha.jp/taisha/",
        "verified_at": "2026-09-12",
        "latitude": 34.5367778,
        "longitude": 135.4608611,
        "goriyaku": "家内安全・厄除け・安産・勝運・合格祈願・商売繁盛",
        "goriyaku_tags": [
            "家内安全",
            "厄除け",
            "安産",
            "勝運",
            "合格祈願",
            "商売繁盛",
        ],
    },
    "御岩神社": {
        "official_name": "御岩神社",
        "official_address": "茨城県日立市入四間町752",
        "official_source_type": "shrine_official",
        "official_source_url": "https://www.oiwajinja.jp/jinjasyoukai.html",
        "verified_at": "2026-09-12",
        "latitude": 36.63604985,
        "longitude": 140.58558306,
        "goriyaku": "安産・家内安全・厄除け・開運・病気平癒・商売繁盛・縁結び",
        "goriyaku_tags": [
            "安産",
            "家内安全",
            "厄除け",
            "開運",
            "病気平癒",
            "商売繁盛",
            "縁結び",
        ],
    },
    "烏森神社": {
        "official_name": "烏森神社",
        "official_address": "東京都港区新橋2-15-5",
        "official_source_type": "shrine_official",
        "official_source_url": "https://karasumorijinja.or.jp/烏森神社について",
        "verified_at": "2026-09-12",
        "latitude": 35.666443,
        "longitude": 139.756134,
        "goriyaku": "商売繁盛・技芸上達・家内安全・勝運",
        "goriyaku_tags": ["商売繁盛", "技芸上達", "家内安全", "勝運"],
    },
    "榴岡天満宮": {
        "official_name": "榴岡天満宮",
        "official_address": "宮城県仙台市宮城野区榴ケ岡105-3",
        "official_source_type": "shrine_official",
        "official_source_url": "https://tsutsujigaokatenmangu.jp/about/",
        "verified_at": "2026-09-12",
        "latitude": 38.260624,
        "longitude": 140.893021,
        "goriyaku": "合格祈願・学業成就・厄除け・安産・交通安全・商売繁盛",
        "goriyaku_tags": [
            "合格祈願",
            "学業成就",
            "厄除け",
            "安産",
            "交通安全",
            "商売繁盛",
        ],
    },
}


def _load_master() -> dict:
    return json.loads(MASTER_PATH.read_text(encoding="utf-8"))


def _effective(master: dict, row: dict) -> dict:
    return {**master.get("candidate_defaults", {}), **row}


def test_wave0_candidate_master_registry_accounting():
    master = _load_master()
    candidates = master["candidates"]

    assert master["schema_version"] == "1.2"
    assert len(candidates) == 44
    assert len({row["candidate_id"] for row in candidates}) == 44
    assert Counter(row["candidate_status"] for row in candidates) == EXPECTED_STATUS_COUNTS
    assert Counter(row["status_reason_code"] for row in candidates) == EXPECTED_REASON_COUNTS


def test_wave0_build_ready_batch_membership_is_deterministic():
    candidates = _load_master()["candidates"]
    build_ready = [row for row in candidates if row["candidate_status"] == "BUILD_READY"]

    assert len(build_ready) == 35
    assert Counter(row["build_batch"] for row in build_ready) == EXPECTED_BUILD_BATCH_COUNTS
    assert all(
        row["build_batch"] is None
        for row in candidates
        if row["candidate_status"] != "BUILD_READY"
    )


def test_wave0_build_batch_uses_the_canonical_db_namespace_only():
    """legacy `W0-B01`〜`W0-B07` が build_batch として残っていないこと。

    これらは Wave0 の工程ID と同じ文字列であり、Candidate Master 内に
    残っていると工程とデータバッチが区別できなくなる。
    """
    candidates = _load_master()["candidates"]

    batches = {row["build_batch"] for row in candidates if row["build_batch"] is not None}
    assert batches == set(CANONICAL_BUILD_BATCHES)

    legacy = [
        (row["candidate_id"], row["build_batch"])
        for row in candidates
        if row["build_batch"] in LEGACY_BUILD_BATCHES
    ]
    assert legacy == []


def test_wave0_db01_member_set_is_frozen():
    """次の Data Build target `W0-DB01` の member set を exact に固定する。"""
    candidates = _load_master()["candidates"]

    members = {
        row["candidate_name"]
        for row in candidates
        if row["build_batch"] == "W0-DB01"
    }
    assert members == EXPECTED_W0_DB01_MEMBERS

    # すべて BUILD_READY であること（HOLD / REVIEW が混ざらない）。
    assert all(
        row["candidate_status"] == "BUILD_READY"
        for row in candidates
        if row["build_batch"] == "W0-DB01"
    )


def test_wave0_db01_candidates_are_hydrated_from_frozen_source_packet():
    master = _load_master()
    rows = {
        row["candidate_name"]: row
        for row in master["candidates"]
        if row["build_batch"] == "W0-DB01"
    }

    assert set(rows) == EXPECTED_W0_DB01_MEMBERS

    for name, expected in EXPECTED_W0_DB01_HYDRATION.items():
        row = rows[name]
        effective = _effective(master, row)

        assert REQUIRED_W0_DB01_HYDRATION_FIELDS <= row.keys()
        assert effective["identity_status"] == "CONFIRMED"
        assert effective["official_source_status"] == "CONFIRMED"
        assert effective["knowledge_status"] == "ACQUISITION_PATH_CONFIRMED"
        assert row["candidate_status"] == "BUILD_READY"
        assert row["status_reason_code"] == "WAVE0_CORE_READY_CANDIDATE"
        assert row["duplicate_status"] == "NEW"

        for field, expected_value in expected.items():
            assert row[field] == expected_value


def test_wave0_hold_and_review_candidates_stay_separated():
    candidates = _load_master()["candidates"]

    for reason, expected_names in EXPECTED_HOLD_BY_REASON.items():
        actual_names = {
            row["candidate_name"]
            for row in candidates
            if row["status_reason_code"] == reason
        }
        assert actual_names == expected_names
        assert all(
            row["candidate_status"] == "HOLD"
            for row in candidates
            if row["status_reason_code"] == reason
        )

    review_names = {
        row["candidate_name"]
        for row in candidates
        if row["status_reason_code"] == "ENTITY_GRANULARITY_REVIEW"
    }
    assert review_names == EXPECTED_REVIEW
    assert all(
        row["candidate_status"] == "REVIEW"
        for row in candidates
        if row["candidate_name"] in EXPECTED_REVIEW
    )


def test_wave0_duplicate_and_availability_states_match_completed_audits():
    master = _load_master()
    candidates = master["candidates"]

    assert Counter(row["duplicate_status"] for row in candidates) == {
        "NEW": 43,
        "REVIEW": 1,
    }

    for row in candidates:
        effective = _effective(master, row)
        if row["build_batch"] == "W0-DB01":
            assert effective["identity_status"] == "CONFIRMED"
            assert effective["official_source_status"] == "CONFIRMED"
            assert effective["knowledge_status"] == "ACQUISITION_PATH_CONFIRMED"
        elif row["candidate_status"] == "REVIEW":
            assert effective["identity_status"] == "UNREVIEWED"
            assert effective["official_source_status"] == "UNREVIEWED"
            assert effective["knowledge_status"] == "UNREVIEWED"
        else:
            assert effective["identity_status"] == "UNREVIEWED"
            assert effective["official_source_status"] == "AVAILABLE"
            assert effective["knowledge_status"] == "ACQUISITION_PATH_CONFIRMED"


def test_wave0_discovery_provenance_has_required_fields():
    master = _load_master()
    required = set(master["required_discovery_fields"])

    for row in master["candidates"]:
        assert row["discovery_sources"]
        for source in row["discovery_sources"]:
            assert required <= source.keys()
            assert source["discovery_source"] == "Omairi 全国神社人気ランキング2026"
            assert source["discovery_source_url"].startswith(
                "https://omairi.club/spots/ranking/shrine"
            )
            assert isinstance(source["discovery_rank"], int)
            assert source["captured_at"]
