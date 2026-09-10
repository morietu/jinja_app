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


def _load_master() -> dict:
    return json.loads(MASTER_PATH.read_text(encoding="utf-8"))


def _effective(master: dict, row: dict) -> dict:
    return {**master.get("candidate_defaults", {}), **row}


def test_wave0_candidate_master_registry_accounting():
    master = _load_master()
    candidates = master["candidates"]

    assert master["schema_version"] == "1.1"
    assert len(candidates) == 44
    assert len({row["candidate_id"] for row in candidates}) == 44
    assert Counter(row["candidate_status"] for row in candidates) == EXPECTED_STATUS_COUNTS
    assert Counter(row["status_reason_code"] for row in candidates) == EXPECTED_REASON_COUNTS


def test_wave0_build_ready_batch_membership_is_deterministic():
    candidates = _load_master()["candidates"]
    build_ready = [row for row in candidates if row["candidate_status"] == "BUILD_READY"]

    assert Counter(row["build_batch"] for row in build_ready) == {
        "W0-B01": 5,
        "W0-B02": 5,
        "W0-B03": 5,
        "W0-B04": 5,
        "W0-B05": 5,
        "W0-B06": 5,
        "W0-B07": 5,
    }
    assert all(
        row["build_batch"] is None
        for row in candidates
        if row["candidate_status"] != "BUILD_READY"
    )


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
        assert effective["identity_status"] == "UNREVIEWED"
        if row["candidate_status"] == "REVIEW":
            assert effective["official_source_status"] == "UNREVIEWED"
            assert effective["knowledge_status"] == "UNREVIEWED"
        else:
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
